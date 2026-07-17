import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

export type PollState = 'ACTIVE' | 'CLOSED';

export type PollOption = { id: string; label: string; sort_order: number };
export type PollVoteRow = { id: string; option_id: string; profile_id: string };

export type PollWithVotes = {
  id: string;
  society_id: string;
  question: string;
  state: PollState;
  created_by: string | null;
  created_at: string;
  closes_at: string | null;
  poll_options: PollOption[];
  poll_votes: PollVoteRow[];
};

const POLL_SELECT = '*, poll_options(id, label, sort_order), poll_votes(id, option_id, profile_id)';

// RLS scopes both to the caller's own society; readable by every society
// member (resident + admin use the same query, one list per role's screen).
export function usePolls() {
  return useQuery({
    queryKey: ['polls'],
    queryFn: async () => {
      const { data, error } = await supabase.from('polls').select(POLL_SELECT).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PollWithVotes[];
    },
  });
}

export function usePollDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['polls', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('polls').select(POLL_SELECT).eq('id', id as string).single();
      if (error) throw error;
      return data as unknown as PollWithVotes;
    },
    enabled: !!id,
  });
}

type CreatePollInput = {
  societyId: string;
  question: string;
  options: string[];
  closesAt: string | null;
};

export function useCreatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePollInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          society_id: input.societyId,
          question: input.question,
          state: 'ACTIVE',
          created_by: user?.id,
          closes_at: input.closesAt,
        })
        .select()
        .single();
      if (pollError) throw pollError;

      const { error: optionsError } = await supabase.from('poll_options').insert(
        input.options.map((label, index) => ({
          poll_id: poll.id,
          society_id: input.societyId,
          label,
          sort_order: index,
        })),
      );
      if (optionsError) throw optionsError;

      return poll as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
  });
}

type CastVoteInput = { pollId: string; optionId: string; societyId: string };

export function useCastVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CastVoteInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // unique(poll_id, profile_id) — upsert lets a resident change their
      // vote instead of erroring on the second tap.
      const { error } = await supabase
        .from('poll_votes')
        .upsert(
          { poll_id: input.pollId, option_id: input.optionId, society_id: input.societyId, profile_id: user?.id },
          { onConflict: 'poll_id,profile_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('polls').update({ state: 'CLOSED' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
    },
  });
}

// In-app Realtime fallback (poll_votes is in the realtime publication) so
// vote counts update live without relying on push.
let pollRealtimeSequence = 0;

export function usePollVotesRealtimeSync(pollId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pollId) return;
    pollRealtimeSequence += 1;
    const channel = supabase
      .channel(`poll_votes:${pollId}:${pollRealtimeSequence}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['polls'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId, queryClient]);
}
