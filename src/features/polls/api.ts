import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getUniqueRealtimeChannelTopic, invalidateSocietyPolls } from '@/commonFunctions';
import { supabase } from '@/lib/supabase';

export type PollState = 'ACTIVE' | 'CLOSED';

export type PollOption = {
  id: string;
  label: string;
  sort_order: number;
  vote_count: number;
};

export type PollVoteRow = {
  id: string;
  option_id: string;
  profile_id: string;
};

export type PollWithVotes = {
  id: string;
  society_id: string;
  question: string;
  state: PollState;
  created_by: string | null;
  created_at: string;
  closes_at: string | null;
  archived_at: string | null;
  poll_options: PollOption[];
  poll_votes: PollVoteRow[];
};

const POLL_SELECT =
  'id, society_id, question, state, created_by, created_at, closes_at, archived_at, poll_options(id, label, sort_order, vote_count), poll_votes(id, option_id, profile_id)';

export function usePolls(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['polls', societyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select(POLL_SELECT)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PollWithVotes[];
    },
    enabled: !!societyId,
  });
}

export function usePollDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['polls', societyId, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('polls')
        .select(POLL_SELECT)
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return data as unknown as PollWithVotes;
    },
    enabled: !!id && !!societyId,
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
      const { data, error } = await supabase
        .rpc('create_admin_poll', {
          requested_question: input.question,
          requested_options: input.options,
          requested_closes_at: input.closesAt,
        })
        .single();
      if (error) throw error;
      const result = data as { id: string; society_id: string } | null;
      if (!result || result.society_id !== input.societyId) throw new Error('Created poll returned an invalid society scope');
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyPolls(queryClient, input.societyId),
  });
}

type CastVoteInput = { pollId: string; optionId: string; societyId: string };

export function useCastVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CastVoteInput) => {
      const { data, error } = await supabase
        .rpc('cast_poll_vote', { target_poll_id: input.pollId, target_option_id: input.optionId })
        .single();
      if (error) throw error;
      const result = data as { society_id: string; poll_id: string } | null;
      if (!result || result.society_id !== input.societyId || result.poll_id !== input.pollId) {
        throw new Error('Vote returned an invalid poll scope');
      }
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyPolls(queryClient, input.societyId),
  });
}

export function useClosePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, societyId }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('close_admin_poll', { target_poll_id: id }).single();
      if (error) throw error;
      const result = data as { society_id: string } | null;
      if (!result || result.society_id !== societyId) throw new Error('Closed poll returned an invalid society scope');
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyPolls(queryClient, input.societyId),
  });
}

export function useArchivePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, societyId }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('archive_admin_poll', { target_poll_id: id }).single();
      if (error) throw error;
      const result = data as { society_id: string } | null;
      if (!result || result.society_id !== societyId) throw new Error('Archived poll returned an invalid society scope');
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyPolls(queryClient, input.societyId),
  });
}

export function usePollVotesRealtimeSync(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const refreshPolls = () => {
      invalidateSocietyPolls(queryClient, societyId);
    };
    const channel = supabase
      .channel(getUniqueRealtimeChannelTopic('poll-results:' + societyId))
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'poll_options', filter: `society_id=eq.${societyId}` },
        refreshPolls,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls', filter: `society_id=eq.${societyId}` },
        refreshPolls,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [societyId, queryClient]);
}
