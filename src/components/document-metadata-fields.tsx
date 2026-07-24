import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius } from '@/constants/commonConstants';
import {
  SocietyDocumentAudiences,
  SocietyDocumentCategories,
  type SocietyDocumentAudience,
  type SocietyDocumentCategory,
} from '@/features/documents/api';

type DocumentMetadataFieldsProps = {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  category: SocietyDocumentCategory;
  onCategoryChange: (value: SocietyDocumentCategory) => void;
  audience: SocietyDocumentAudience;
  onAudienceChange: (value: SocietyDocumentAudience) => void;
  published: boolean;
  onPublishedChange: (value: boolean) => void;
};

export function DocumentMetadataFields(props: DocumentMetadataFieldsProps) {
  return <><Text style={styles.label}>TITLE</Text><TextInput value={props.title} onChangeText={props.onTitleChange} placeholder="Society bylaws 2026" placeholderTextColor={Colors.textFaint} style={styles.input} /><Text style={styles.label}>DESCRIPTION</Text><TextInput value={props.description} onChangeText={props.onDescriptionChange} placeholder="Optional context for residents" placeholderTextColor={Colors.textFaint} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" /><Text style={styles.label}>CATEGORY</Text><View style={styles.choices}>{SocietyDocumentCategories.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: props.category === item }} onPress={() => props.onCategoryChange(item)} style={[styles.choice, props.category === item && styles.choiceActive]}><Text style={[styles.choiceLabel, props.category === item && styles.choiceLabelActive]}>{item}</Text></Pressable>)}</View><Text style={styles.label}>WHO CAN ACCESS</Text><View style={styles.choices}>{SocietyDocumentAudiences.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: props.audience === item }} onPress={() => props.onAudienceChange(item)} style={[styles.choice, props.audience === item && styles.choiceActive]}><Text style={[styles.choiceLabel, props.audience === item && styles.choiceLabelActive]}>{item === 'ALL' ? 'Residents & Guards' : item === 'RESIDENT' ? 'Residents' : 'Guards'}</Text></Pressable>)}</View><Text style={styles.label}>VISIBILITY</Text><View style={styles.choices}>{[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="radio" accessibilityState={{ checked: props.published === value }} onPress={() => props.onPublishedChange(value)} style={[styles.choice, props.published === value && styles.choiceActive]}><Text style={[styles.choiceLabel, props.published === value && styles.choiceLabelActive]}>{value ? 'Publish now' : 'Save as draft'}</Text></Pressable>)}</View></>;
}

const styles = StyleSheet.create({ label: { marginTop: 18, fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700', color: Colors.textMutedAlt }, input: { minHeight: 50, marginTop: 7, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, color: Colors.textPrimary }, multiline: { minHeight: 92 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, choice: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 }, choiceLabel: { fontSize: 11.5, fontWeight: '700', color: Colors.textPrimary }, choiceLabelActive: { color: Colors.textOnDark } });
