import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { getErrorMessage, isValidAmenitySlotSchedule, isValidAmenityTimeRange } from '@/commonFunctions';
import { FullScreenImageViewer } from '@/components/full-screen-image-viewer';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import {
  AMENITY_DEFAULT_ADVANCE_BOOKING_DAYS,
  AMENITY_DEFAULT_DAILY_BOOKING_LIMIT,
  AMENITY_DEFAULT_SLOT_DURATION_MINUTES,
  AMENITY_IMAGE_MAX_COUNT,
  AMENITY_MAX_ADVANCE_BOOKING_DAYS,
  AMENITY_MAX_DAILY_BOOKING_LIMIT,
  AMENITY_MAX_SHARED_CAPACITY,
  AmenityBookingTypes,
  AmenitySlotDurations,
  Colors,
  FontFamily,
  Radius,
} from '@/constants/commonConstants';
import type { AmenityPhotoInput } from '@/features/amenities/api';
import { prepareAmenityPhoto } from '@/features/amenities/image';
import { showToast } from '@/stores/toast-store';

export type AmenityFormValue = {
  name: string;
  description: string;
  openTime: string;
  closeTime: string;
  bookingType: 'EXCLUSIVE' | 'SHARED';
  slotDurationMinutes: number;
  maxBookingsPerSlot: number;
  advanceBookingDays: number;
  maxBookingsPerResidentPerDay: number;
  requiresAdminApproval: boolean;
  rulesAndRegulations: string;
  photos: AmenityPhotoInput[];
};

type AmenityFormProps = {
  title: string;
  submitLabel: string;
  initialValue?: AmenityFormValue;
  isPending: boolean;
  onSubmit: (value: AmenityFormValue) => Promise<void>;
};

function CameraSourceIcon() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 5.5 10 3.75h4l1.5 1.75H19a2 2 0 0 1 2 2v9.75a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h3.5Z" stroke={Colors.success700} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={12.25} r={3.25} stroke={Colors.success700} strokeWidth={1.8} />
    </Svg>
  );
}

function GallerySourceIcon() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={2.5} stroke={Colors.success700} strokeWidth={1.8} />
      <Circle cx={8.25} cy={9} r={1.5} fill={Colors.success700} />
      <Path d="m5.5 17 4.25-4.25 2.75 2.75 2.25-2.25L19 17.5" stroke={Colors.success700} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AmenityForm({
  title,
  submitLabel,
  initialValue = {
    name: '',
    description: '',
    openTime: '07:00',
    closeTime: '21:00',
    bookingType: 'EXCLUSIVE',
    slotDurationMinutes: AMENITY_DEFAULT_SLOT_DURATION_MINUTES,
    maxBookingsPerSlot: 1,
    advanceBookingDays: AMENITY_DEFAULT_ADVANCE_BOOKING_DAYS,
    maxBookingsPerResidentPerDay: AMENITY_DEFAULT_DAILY_BOOKING_LIMIT,
    requiresAdminApproval: true,
    rulesAndRegulations: '',
    photos: [],
  },
  isPending,
  onSubmit,
}: AmenityFormProps) {
  const [name, setName] = useState(initialValue.name);
  const [description, setDescription] = useState(initialValue.description);
  const [openTime, setOpenTime] = useState(initialValue.openTime);
  const [closeTime, setCloseTime] = useState(initialValue.closeTime);
  const [bookingType, setBookingType] = useState(initialValue.bookingType);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(initialValue.slotDurationMinutes);
  const [maxBookingsPerSlot, setMaxBookingsPerSlot] = useState(String(initialValue.maxBookingsPerSlot));
  const [advanceBookingDays, setAdvanceBookingDays] = useState(String(initialValue.advanceBookingDays));
  const [maxBookingsPerResidentPerDay, setMaxBookingsPerResidentPerDay] = useState(String(initialValue.maxBookingsPerResidentPerDay));
  const [requiresAdminApproval, setRequiresAdminApproval] = useState(initialValue.requiresAdminApproval);
  const [rulesAndRegulations, setRulesAndRegulations] = useState(initialValue.rulesAndRegulations);
  const [photos, setPhotos] = useState(initialValue.photos);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSourceChooserOpen, setIsSourceChooserOpen] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const canSave = name.trim().length > 1
    && isValidAmenitySlotSchedule(openTime, closeTime, slotDurationMinutes)
    && Number.isInteger(Number(maxBookingsPerSlot))
    && Number(maxBookingsPerSlot) > 0
    && Number(maxBookingsPerSlot) <= AMENITY_MAX_SHARED_CAPACITY
    && Number.isInteger(Number(advanceBookingDays))
    && Number(advanceBookingDays) >= 0
    && Number(advanceBookingDays) <= AMENITY_MAX_ADVANCE_BOOKING_DAYS
    && Number.isInteger(Number(maxBookingsPerResidentPerDay))
    && Number(maxBookingsPerResidentPerDay) > 0
    && Number(maxBookingsPerResidentPerDay) <= AMENITY_MAX_DAILY_BOOKING_LIMIT;
  async function selectPhotos(source: 'camera' | 'library') {
    const remaining = AMENITY_IMAGE_MAX_COUNT - photos.length;
    if (remaining <= 0) {
      showToast('You can add up to 4 amenity photos');
      return;
    }

    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast('Camera access is needed. Enable it in your phone settings and try again.');
          return;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showToast('Photo access is needed. Enable it in your phone settings and try again.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: true,
              selectionLimit: remaining,
              quality: 1,
            });
      if (result.canceled) return;

      setIsProcessing(true);
      const selected: AmenityPhotoInput[] = [];
      let processingError: string | null = null;

      for (const asset of result.assets.slice(0, remaining)) {
        try {
          selected.push(await prepareAmenityPhoto(asset.uri, asset.width));
        } catch (error) {
          processingError ??= getErrorMessage(error, 'One photo could not be compressed');
        }
      }

      setPhotos((current) => [...current, ...selected].slice(0, AMENITY_IMAGE_MAX_COUNT));
      if (processingError) showToast(processingError);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not open the camera or photo gallery'));
    } finally {
      setIsProcessing(false);
    }
  }

  function movePhoto(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    setPhotos((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setSelectedPhotoIndex(nextIndex);
  }

  function makeCover(index: number) {
    if (index === 0) return;
    setPhotos((current) => {
      const next = [...current];
      const [photo] = next.splice(index, 1);
      next.unshift(photo);
      return next;
    });
    setSelectedPhotoIndex(0);
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const next = current.filter((_, photoIndex) => photoIndex !== index);
      setSelectedPhotoIndex(next.length === 0 ? 0 : Math.min(index, next.length - 1));
      return next;
    });
  }

  async function handleSave() {
    if (!canSave || isPending || isProcessing) return;
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      openTime,
      closeTime,
      bookingType,
      slotDurationMinutes,
      maxBookingsPerSlot: bookingType === 'EXCLUSIVE' ? 1 : Number(maxBookingsPerSlot),
      advanceBookingDays: Number(advanceBookingDays),
      maxBookingsPerResidentPerDay: Number(maxBookingsPerResidentPerDay),
      requiresAdminApproval,
      rulesAndRegulations: rulesAndRegulations.trim(),
      photos,
    });

  }
  function handleSelectPhotoSource(source: 'camera' | 'library') {
    setIsSourceChooserOpen(false);
    void selectPhotos(source);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <Text style={styles.label}>NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        onBlur={() => setName((value) => value.trim())}
        placeholder="e.g. Swimming Pool"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
        maxLength={100}
      />

      <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        onBlur={() => setDescription((value) => value.trim())}
        placeholder="A short note residents will see"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.textarea]}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />

      <View style={styles.photoHeading}>
        <View style={styles.flex}>
          <Text style={styles.label}>AMENITY PHOTOS</Text>
          <Text style={styles.photoHint}>Up to four photos. The first one is the cover residents see.</Text>
        </View>
        <View style={styles.photoCountPill}>
          <Text style={styles.photoCount}>{photos.length}/{AMENITY_IMAGE_MAX_COUNT}</Text>
        </View>
      </View>

      {photos.length > 0 ? (
        <View style={styles.galleryEditor}>
          <Pressable
            style={styles.coverPreview}
            onPress={() => setViewerUri(photos[selectedPhotoIndex].uri)}
            accessibilityRole="button"
            accessibilityLabel="Open selected amenity photo">
            <Image
              source={{ uri: photos[selectedPhotoIndex].uri }}
              style={styles.coverImage}
              contentFit="cover"
              transition={150}
            />
            <View style={styles.coverShade} />
            <View style={styles.coverPill}>
              <Text style={styles.coverLabel}>
                {selectedPhotoIndex === 0 ? 'COVER PHOTO' : 'PHOTO ' + (selectedPhotoIndex + 1)}
              </Text>
            </View>
            <View style={styles.previewHintPill}>
              <Text style={styles.previewHintLabel}>Tap to enlarge</Text>
            </View>
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailRow}>
            {photos.map((photo, index) => (
              <Pressable
                key={photo.storagePath ?? photo.uri}
                style={[
                  styles.thumbnailButton,
                  index === selectedPhotoIndex && styles.thumbnailButtonSelected,
                ]}
                onPress={() =>
                  index === selectedPhotoIndex
                    ? setViewerUri(photo.uri)
                    : setSelectedPhotoIndex(index)
                }
                accessibilityRole="button"
                accessibilityLabel={'Select photo ' + (index + 1)}>
                <Image source={{ uri: photo.uri }} style={styles.thumbnail} contentFit="cover" />
                <View style={[styles.numberPill, index === 0 && styles.coverNumberPill]}>
                  <Text style={styles.numberLabel}>{index === 0 ? 'Cover' : index + 1}</Text>
                </View>
              </Pressable>
            ))}
            {photos.length < AMENITY_IMAGE_MAX_COUNT && (
              <Pressable
                style={styles.addThumbnail}
                onPress={() => setIsSourceChooserOpen(true)}
                disabled={isProcessing || isPending}>
                <Text style={styles.addThumbnailIcon}>+</Text>
                <Text style={styles.addThumbnailLabel}>Add</Text>
              </Pressable>
            )}
          </ScrollView>

          <View style={styles.editActions}>
            <Pressable
              style={[styles.editAction, selectedPhotoIndex === 0 && styles.actionDisabled]}
              onPress={() => movePhoto(selectedPhotoIndex, -1)}
              disabled={selectedPhotoIndex === 0 || isProcessing || isPending}>
              <Text style={styles.editActionLabel}>Move left</Text>
            </Pressable>
            <Pressable
              style={[styles.coverAction, selectedPhotoIndex === 0 && styles.actionDisabled]}
              onPress={() => makeCover(selectedPhotoIndex)}
              disabled={selectedPhotoIndex === 0 || isProcessing || isPending}>
              <Text style={styles.coverActionLabel}>Make cover</Text>
            </Pressable>
            <Pressable
              style={[
                styles.editAction,
                selectedPhotoIndex === photos.length - 1 && styles.actionDisabled,
              ]}
              onPress={() => movePhoto(selectedPhotoIndex, 1)}
              disabled={selectedPhotoIndex === photos.length - 1 || isProcessing || isPending}>
              <Text style={styles.editActionLabel}>Move right</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.removeButton}
            onPress={() => removePhoto(selectedPhotoIndex)}
            disabled={isProcessing || isPending}>
            <Text style={styles.removeLabel}>Remove selected photo</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.emptyPhotoCard}
          onPress={() => setIsSourceChooserOpen(true)}
          disabled={isProcessing || isPending}
          accessibilityRole="button"
          accessibilityLabel="Add amenity photos">
          <View style={styles.emptyPhotoIcon}>
            <Text style={styles.emptyPhotoIconLabel}>+</Text>
          </View>
          <Text style={styles.emptyPhotoTitle}>Show residents what to expect</Text>
          <Text style={styles.emptyPhotoText}>Tap to add photos from your camera or gallery.</Text>
        </Pressable>
      )}



      {isProcessing && (
        <View style={styles.processingCard}>
          <ActivityIndicator size="small" color={Colors.green400} />
          <View style={styles.flex}>
            <Text style={styles.processingTitle}>Optimizing photos</Text>
            <Text style={styles.processingText}>Compressing and checking upload size...</Text>
          </View>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>OPENS (24H)</Text>
          <TextInput value={openTime} onChangeText={setOpenTime} placeholder="07:00" placeholderTextColor={Colors.textFaint} style={styles.input} maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>CLOSES (24H)</Text>
          <TextInput value={closeTime} onChangeText={setCloseTime} placeholder="21:00" placeholderTextColor={Colors.textFaint} style={styles.input} maxLength={5} keyboardType="numbers-and-punctuation" />
        </View>
      </View>

      {!isValidAmenityTimeRange(openTime, closeTime) && (
        <Text style={styles.validationError}>Use 24-hour HH:MM times, with opening before closing.</Text>
      )}

      {isValidAmenityTimeRange(openTime, closeTime)
        && !isValidAmenitySlotSchedule(openTime, closeTime, slotDurationMinutes) && (
          <Text style={styles.validationError}>Operating hours must divide evenly into the selected slot duration.</Text>
        )}
      <Text style={styles.sectionTitle}>Booking setup</Text>
      <Text style={styles.fieldHint}>Choose how residents share and reserve this amenity.</Text>

      <Text style={styles.label}>BOOKING TYPE</Text>
      <View style={styles.optionRow}>
        {AmenityBookingTypes.map((option) => {
          const selected = bookingType === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => {
                setBookingType(option.value);
                if (option.value === 'EXCLUSIVE') setMaxBookingsPerSlot('1');
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{option.label}</Text>
              <Text style={[styles.optionDescription, selected && styles.optionDescriptionSelected]}>{option.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>SLOT DURATION</Text>
      <View style={styles.chipRow}>
        {AmenitySlotDurations.map((minutes) => {
          const selected = slotDurationMinutes === minutes;
          return (
            <Pressable
              key={minutes}
              style={[styles.choiceChip, selected && styles.choiceChipSelected]}
              onPress={() => setSlotDurationMinutes(minutes)}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <Text style={[styles.choiceChipLabel, selected && styles.choiceChipLabelSelected]}>
                {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.fieldHint}>Operating hours must divide evenly into this duration.</Text>

      {bookingType === 'SHARED' && (
        <>
          <Text style={styles.label}>BOOKINGS PER SLOT</Text>
          <TextInput
            value={maxBookingsPerSlot}
            onChangeText={setMaxBookingsPerSlot}
            placeholder="e.g. 15"
            placeholderTextColor={Colors.textFaint}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={3}
          />
        </>
      )}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>BOOK DAYS AHEAD</Text>
          <TextInput value={advanceBookingDays} onChangeText={setAdvanceBookingDays} style={styles.input} keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>DAILY LIMIT</Text>
          <TextInput value={maxBookingsPerResidentPerDay} onChangeText={setMaxBookingsPerResidentPerDay} style={styles.input} keyboardType="number-pad" maxLength={2} />
        </View>
      </View>

      <Text style={styles.label}>CONFIRMATION</Text>
      <View style={styles.optionRow}>
        <Pressable
          style={[styles.optionCard, requiresAdminApproval && styles.optionCardSelected]}
          onPress={() => setRequiresAdminApproval(true)}
          accessibilityRole="button"
          accessibilityState={{ selected: requiresAdminApproval }}>
          <Text style={[styles.optionTitle, requiresAdminApproval && styles.optionTitleSelected]}>Admin approval</Text>
          <Text style={[styles.optionDescription, requiresAdminApproval && styles.optionDescriptionSelected]}>Requests stay pending until reviewed.</Text>
        </Pressable>
        <Pressable
          style={[styles.optionCard, !requiresAdminApproval && styles.optionCardSelected]}
          onPress={() => setRequiresAdminApproval(false)}
          accessibilityRole="button"
          accessibilityState={{ selected: !requiresAdminApproval }}>
          <Text style={[styles.optionTitle, !requiresAdminApproval && styles.optionTitleSelected]}>Instant</Text>
          <Text style={[styles.optionDescription, !requiresAdminApproval && styles.optionDescriptionSelected]}>Available capacity confirms immediately.</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>RULES (OPTIONAL)</Text>
      <TextInput
        value={rulesAndRegulations}
        onChangeText={setRulesAndRegulations}
        placeholder="What residents should know before booking"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.rulesInput]}
        multiline
        maxLength={1000}
        textAlignVertical="top"
      />

      <Pressable style={[styles.saveButton, (!canSave || isProcessing) && styles.saveDisabled]} onPress={handleSave} disabled={!canSave || isPending || isProcessing} accessibilityRole="button" accessibilityLabel={submitLabel}>
        {isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
        <Text style={[styles.saveLabel, (!canSave || isProcessing) && styles.saveLabelDisabled]}>
          {isPending && photos.some((photo) => !photo.storagePath) ? 'Uploading photos...' : submitLabel}
        </Text>
      </Pressable>
      <Modal
        visible={isSourceChooserOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsSourceChooserOpen(false)}>
        <View style={styles.sourceModal} accessibilityViewIsModal>
          <Pressable
            style={styles.sourceBackdrop}
            onPress={() => setIsSourceChooserOpen(false)}
            accessibilityLabel="Close photo source menu"
          />
          <View style={styles.sourceSheet}>
            <View style={styles.sourceHandle} />
            <Text style={styles.sourceText}>Choose where you want to add photos from.</Text>
            <Pressable
              style={styles.sourceOption}
              onPress={() => handleSelectPhotoSource('camera')}
              accessibilityRole="button">
              <View style={styles.sourceIcon}><CameraSourceIcon /></View>
              <View style={styles.flex}>
                <Text style={styles.sourceOptionTitle}>Take a photo</Text>
                <Text style={styles.sourceOptionText}>Open the camera for a new photo</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.sourceOption}
              onPress={() => handleSelectPhotoSource('library')}
              accessibilityRole="button">
              <View style={styles.sourceIcon}><GallerySourceIcon /></View>
              <View style={styles.flex}>
                <Text style={styles.sourceOptionTitle}>Choose from gallery</Text>
                <Text style={styles.sourceOptionText}>Select one or more existing photos</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.sourceCancel}
              onPress={() => setIsSourceChooserOpen(false)}
              accessibilityRole="button">
              <Text style={styles.sourceCancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <FullScreenImageViewer
        uri={viewerUri}
        visible={!!viewerUri}
        onClose={() => setViewerUri(null)}
        accessibilityLabel="Close amenity photo"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  input: { marginTop: 8, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, paddingVertical: 14, paddingHorizontal: 15, fontSize: 15.5, color: Colors.textPrimary },
  textarea: { minHeight: 80 },
  row: { flexDirection: 'row', gap: 10 },
  validationError: { marginTop: 10, fontSize: 12.5, color: Colors.danger700 },
  photoHeading: { marginTop: 22, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  photoHint: { marginTop: 5, fontSize: 12.5, color: Colors.textMuted, lineHeight: 18 },
  photoCountPill: { marginTop: 20, minWidth: 42, height: 28, paddingHorizontal: 9, borderRadius: 14, backgroundColor: '#E4EEE8', alignItems: 'center', justifyContent: 'center' },
  photoCount: { fontSize: 12, color: Colors.success700, fontWeight: '800' },
  galleryEditor: { marginTop: 12, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden' },
  coverPreview: { height: 188, backgroundColor: Colors.border },
  coverImage: { width: '100%', height: '100%' },
  coverShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4, 28, 18, 0.18)' },
  coverPill: { position: 'absolute', top: 12, left: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.green500 },
  coverLabel: { color: Colors.textOnDark, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.7 },
  thumbnailRow: { gap: 8, padding: 12 },
  thumbnailButton: { width: 66, height: 58, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', backgroundColor: Colors.border },
  thumbnailButtonSelected: { borderColor: Colors.green400 },
  thumbnail: { width: '100%', height: '100%' },
  numberPill: { position: 'absolute', left: 4, bottom: 4, minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8, 25, 17, 0.72)' },
  coverNumberPill: { backgroundColor: Colors.green500 },
  numberLabel: { color: Colors.textOnDark, fontSize: 8.5, fontWeight: '800' },
  addThumbnail: { width: 58, height: 58, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.adminCanvas },
  addThumbnailIcon: { color: Colors.success700, fontSize: 19, lineHeight: 20, fontWeight: '700' },
  addThumbnailLabel: { color: Colors.textMuted, fontSize: 9.5, fontWeight: '700' },
  editActions: { flexDirection: 'row', gap: 7, paddingHorizontal: 12, paddingBottom: 10 },
  editAction: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' },
  coverAction: { flex: 1.2, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E4EEE8' },
  actionDisabled: { opacity: 0.38 },
  editActionLabel: { color: Colors.textMutedAlt, fontSize: 10.5, fontWeight: '700' },
  coverActionLabel: { color: Colors.success700, fontSize: 10.5, fontWeight: '800' },
  removeButton: { minHeight: 38, marginHorizontal: 12, marginBottom: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4F1' },
  removeLabel: { color: Colors.danger700, fontSize: 11.5, fontWeight: '700' },
  emptyPhotoCard: { minHeight: 150, marginTop: 12, paddingHorizontal: 24, borderRadius: Radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.borderAlt, backgroundColor: '#F8F5EC', alignItems: 'center', justifyContent: 'center' },
  emptyPhotoIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E4EEE8', alignItems: 'center', justifyContent: 'center' },
  emptyPhotoIconLabel: { color: Colors.success700, fontSize: 24, lineHeight: 27 },
  emptyPhotoTitle: { marginTop: 10, fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  emptyPhotoText: { marginTop: 5, textAlign: 'center', fontSize: 11.5, color: Colors.textMuted },
  processingCard: { marginTop: 10, minHeight: 58, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#EAF2ED' },
  processingTitle: { color: Colors.success700, fontSize: 12.5, fontWeight: '800' },
  processingText: { marginTop: 2, color: Colors.textMuted, fontSize: 10.5 },
  previewHintPill: { position: 'absolute', right: 12, bottom: 12, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(9,24,16,0.72)' },
  previewHintLabel: { color: Colors.textOnDark, fontSize: 10, fontWeight: '700' },
  sourceModal: { flex: 1, justifyContent: 'flex-end' },
  sourceBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(5, 18, 12, 0.52)' },
  sourceSheet: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: Colors.adminCanvas },
  sourceHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.borderAlt },
  sourceTitle: { marginTop: 18, fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.textPrimary },
  sourceText: { marginTop: 5, marginBottom: 14, fontSize: 12.5, color: Colors.textMuted },
  sourceOption: { minHeight: 68, marginTop: 9, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sourceIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E4EEE8', alignItems: 'center', justifyContent: 'center' },
  sourceOptionTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  sourceOptionText: { marginTop: 2, fontSize: 11, color: Colors.textMuted },
  sourceCancel: { minHeight: 48, marginTop: 14, borderRadius: Radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E2D4' },
  sourceCancelLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.textMutedAlt },
  sectionTitle: { marginTop: 28, fontFamily: FontFamily.headingBold, fontSize: 17, color: Colors.textPrimary },
  fieldHint: { marginTop: 6, fontSize: 11.5, lineHeight: 17, color: Colors.textMuted },
  optionRow: { flexDirection: 'row', gap: 9, marginTop: 9 },
  optionCard: { flex: 1, minHeight: 86, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface },
  optionCardSelected: { borderColor: Colors.green500, backgroundColor: '#EAF2ED' },
  optionTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  optionTitleSelected: { color: Colors.success700 },
  optionDescription: { marginTop: 4, fontSize: 10.5, lineHeight: 15, color: Colors.textMuted },
  optionDescriptionSelected: { color: Colors.textMutedAlt },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  choiceChip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  choiceChipSelected: { borderColor: Colors.green500, backgroundColor: Colors.green500 },
  choiceChipLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textMutedAlt },
  choiceChipLabelSelected: { color: Colors.textOnDark },
  rulesInput: { minHeight: 96 },
  saveButton: { marginTop: 30, minHeight: 54, borderRadius: Radius.card - 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, backgroundColor: Colors.green500 },
  saveDisabled: { backgroundColor: '#DDD8C8' },
  saveLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark },
  saveLabelDisabled: { color: '#9B9682' },
});
