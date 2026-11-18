import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Image as ImageIcon,
  DollarSign,
  Users,
  Link as LinkIcon,
  Check,
  Eye,
  Save,
  AlertCircle,
  Building,
  Upload
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EVENT_CATEGORIES, UW_FACULTIES } from '../../data/mockData';
import { EventCategory, OrganizerType, EventItem } from '../../types';
import { EventDetailModal } from '../feed/EventDetailModal';
import { LocationMapPicker } from './LocationMapPicker';

interface CreateEventTabProps {
  onEventCreated?: (eventId: string) => void;
  initialDraft?: EventItem | null;
}

export const CreateEventTab: React.FC<CreateEventTabProps> = ({
  onEventCreated,
  initialDraft
}) => {
  const { createEvent, updateEvent, user } = useApp();

  // Form states
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [organizer, setOrganizer] = useState(initialDraft?.organizer || 'UW Student Initiative');
  const [organizerType, setOrganizerType] = useState<OrganizerType>(
    initialDraft?.organizerType || 'Clubs'
  );
  const [category, setCategory] = useState<EventCategory>(
    initialDraft?.category || 'Technology'
  );
  const [facultyAffiliation, setFacultyAffiliation] = useState(
    initialDraft?.facultyAffiliation || 'All Faculties'
  );
  const [description, setDescription] = useState(initialDraft?.description || '');
  const [date, setDate] = useState(initialDraft?.date || '2026-10-30');
  const [startTime, setStartTime] = useState(initialDraft?.startTime || '17:00');
  const [endTime, setEndTime] = useState(initialDraft?.endTime || '19:30');
  const [isOnline, setIsOnline] = useState(initialDraft?.isOnline || false);
  const [location, setLocation] = useState(
    initialDraft?.location || 'Student Life Centre (SLC) Multi-Purpose Room'
  );
  const [venueName, setVenueName] = useState(
    initialDraft?.venueName || 'Student Life Centre (SLC)'
  );
  const [address, setAddress] = useState(
    initialDraft?.address || '200 University Ave W, Waterloo, ON N2L 3G1'
  );
  const [roomNumber, setRoomNumber] = useState(
    initialDraft?.roomNumber || 'Multi-Purpose Room (MPR)'
  );
  const [arrivalInstructions, setArrivalInstructions] = useState(
    initialDraft?.arrivalInstructions || ''
  );
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>(
    initialDraft?.coordinates || { lat: 43.47175, lng: -80.54535 }
  );
  const [isFree, setIsFree] = useState(initialDraft?.isFree ?? true);
  const [price, setPrice] = useState(initialDraft?.price || 'Free');
  const [eligibility, setEligibility] = useState(
    initialDraft?.eligibility || 'Open to all University of Waterloo students.'
  );
  const [registrationUrl, setRegistrationUrl] = useState(
    initialDraft?.registrationUrl || 'https://wusa.ca/events/demo'
  );
  const [registrationDeadline, setRegistrationDeadline] = useState(
    initialDraft?.registrationDeadline || ''
  );
  const [accessibility, setAccessibility] = useState(
    initialDraft?.accessibility || 'Wheelchair accessible, ground-level entrance with elevator access.'
  );
  const [isResearchStudy, setIsResearchStudy] = useState(
    initialDraft?.isResearchStudy || false
  );

  // Cover image selection (presets + custom URL)
  const imagePresets = [
    { label: 'Campus Social', url: '/src/assets/images/wathive_campus_social_1792617947412.jpg' },
    { label: 'Tech & Hackathon', url: '/src/assets/images/wathive_hackathon_1792617946142.jpg' },
    { label: 'Career Showcase', url: '/src/assets/images/wathive_career_fair_1792617948325.jpg' },
    { label: 'Athletics & Sports', url: '/src/assets/images/wathive_sports_intramural_1792617947784.jpg' },
    { label: 'Research Study', url: '/src/assets/images/wathive_research_lab_1792617948983.jpg' }
  ];

  const [coverImage, setCoverImage] = useState(
    initialDraft?.coverImage || imagePresets[0].url
  );
  const [customImageUrl, setCustomImageUrl] = useState('');

  // Validation & feedback state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewEvent, setPreviewEvent] = useState<EventItem | null>(null);
  const [successBanner, setSuccessBanner] = useState('');

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Event title is required.';
    }
    if (!organizer.trim()) {
      newErrors.organizer = 'Organizer or club name is required.';
    }
    if (!description.trim()) {
      newErrors.description = 'Event description is required.';
    }
    if (!date) {
      newErrors.date = 'Event date is required.';
    }
    if (!startTime) {
      newErrors.startTime = 'Start time is required.';
    }
    if (!endTime) {
      newErrors.endTime = 'End time is required.';
    }

    // End time must be after start time
    if (startTime && endTime) {
      if (endTime <= startTime) {
        newErrors.endTime = 'End time must be later than the start time.';
      }
    }

    if (isOnline) {
      if (!location.trim()) {
        newErrors.location = 'Online meeting link/platform is required.';
      }
    } else {
      if (!venueName.trim() && !location.trim()) {
        newErrors.location = 'Campus venue name is required.';
      }
    }

    // URL validation for registration
    if (registrationUrl.trim()) {
      try {
        new URL(registrationUrl);
      } catch {
        newErrors.registrationUrl = 'Please enter a valid URL (e.g., https://...)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const constructEventObject = (status: 'published' | 'draft'): Omit<EventItem, 'id' | 'createdAt' | 'creatorId' | 'status'> => {
    const combinedLocation = isOnline
      ? location.trim()
      : roomNumber.trim()
      ? `${venueName.trim()} - ${roomNumber.trim()}`
      : venueName.trim() || location.trim();

    return {
      title: title.trim(),
      coverImage: customImageUrl.trim() || coverImage,
      organizer: organizer.trim(),
      organizerType,
      category,
      facultyAffiliation: facultyAffiliation === 'All Faculties' ? undefined : facultyAffiliation,
      description: description.trim(),
      date,
      startTime,
      endTime,
      isOnline,
      location: combinedLocation,
      coordinates: isOnline ? undefined : coordinates,
      venueName: isOnline ? undefined : venueName.trim(),
      address: isOnline ? undefined : address.trim(),
      roomNumber: isOnline ? undefined : roomNumber.trim(),
      arrivalInstructions: isOnline ? undefined : arrivalInstructions.trim(),
      isFree,
      price: isFree ? 'Free' : (price.trim() || '$5.00'),
      eligibility: eligibility.trim(),
      registrationUrl: registrationUrl.trim() || 'https://uwaterloo.ca',
      registrationDeadline: registrationDeadline.trim() || undefined,
      accessibility: accessibility.trim() || undefined,
      isResearchStudy
    };
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const data = constructEventObject('published');
    if (initialDraft && initialDraft.id) {
      updateEvent(initialDraft.id, { ...data, status: 'published' });
      setSuccessBanner(`"${title}" updated and published successfully!`);
    } else {
      const created = createEvent(data, false);
      setSuccessBanner(`"${title}" published! It is now live in the campus feed.`);
      onEventCreated?.(created.id);
    }

    // Reset form after 2.5 seconds
    setTimeout(() => {
      setSuccessBanner('');
      setTitle('');
      setDescription('');
    }, 3000);
  };

  const handleSaveDraft = () => {
    if (!title.trim()) {
      setErrors({ title: 'Please provide at least a title for your draft.' });
      return;
    }

    const data = constructEventObject('draft');
    if (initialDraft && initialDraft.id) {
      updateEvent(initialDraft.id, { ...data, status: 'draft' });
      setSuccessBanner(`Draft "${title}" saved to your profile.`);
    } else {
      createEvent(data, true);
      setSuccessBanner(`Draft "${title}" saved to your profile.`);
    }

    setTimeout(() => setSuccessBanner(''), 3000);
  };

  const handleOpenPreview = () => {
    if (!title.trim()) {
      setErrors({ title: 'Please enter a title to preview.' });
      return;
    }

    const simulatedEvent: EventItem = {
      id: initialDraft?.id || 'preview_id',
      ...constructEventObject('published'),
      creatorId: user?.id || 'me',
      status: 'published',
      createdAt: new Date().toISOString()
    };
    setPreviewEvent(simulatedEvent);
  };

  return (
    <div className="pb-20 md:pb-12 max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          Create & Manage Campus Events
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          Promote student initiatives, club meetings, intramural socials, or academic research studies.
        </p>
      </div>

      {successBanner && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-950 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-in fade-in">
          <Check className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      <form onSubmit={handlePublish} className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-8 space-y-6 shadow-xs">
        {/* Section 1: Event Essentials */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2 flex items-center gap-2">
            <span>1. Basic Details</span>
          </h2>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Waterloo Game Jam: 48h Student Showcase"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400 ${
                errors.title ? 'border-red-400 bg-red-50/30' : 'border-stone-200'
              }`}
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Organizer or Club Name *
              </label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="e.g. UW Robotics Club / EngSoc"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400 ${
                  errors.organizer ? 'border-red-400 bg-red-50/30' : 'border-stone-200'
                }`}
              />
              {errors.organizer && <p className="text-xs text-red-600 mt-1">{errors.organizer}</p>}
              <p className="text-[11px] text-stone-600 mt-1">
                Demo organizers are not given a verified badge.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Organizer Type
              </label>
              <select
                value={organizerType}
                onChange={(e) => {
                  const type = e.target.value as OrganizerType;
                  setOrganizerType(type);
                  if (type === 'Research studies') {
                    setIsResearchStudy(true);
                    setCategory('Research participation');
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              >
                <option value="Clubs">Clubs</option>
                <option value="Student societies">Student societies</option>
                <option value="WUSA">WUSA</option>
                <option value="Faculties">Faculties</option>
                <option value="Research studies">Research studies</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as EventCategory;
                  setCategory(cat);
                  if (cat === 'Research participation') {
                    setIsResearchStudy(true);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Faculty Affiliation (Optional)
              </label>
              <select
                value={facultyAffiliation}
                onChange={(e) => setFacultyAffiliation(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              >
                <option value="All Faculties">All Faculties (Campus-wide)</option>
                {UW_FACULTIES.map((fac) => (
                  <option key={fac} value={fac}>{fac}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Research study flag notice */}
          {isResearchStudy && (
            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Research Study Recruitment Setting
              </span>
              <p className="text-[11px] leading-normal">
                Per user privacy requirements, attendee lists and buddy matching are automatically disabled for research participation events.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Full Description *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline what attendees can expect, agenda, what to bring, and registration prerequisites..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400 resize-none ${
                errors.description ? 'border-red-400 bg-red-50/30' : 'border-stone-200'
              }`}
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </div>
        </div>

        {/* Section 2: Visual Cover Image */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2 flex items-center gap-2">
            <span>2. Cover Image</span>
          </h2>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700">
              Select Campus Preset or Enter Image URL
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {imagePresets.map((preset) => {
                const isSelected = coverImage === preset.url && !customImageUrl;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setCoverImage(preset.url);
                      setCustomImageUrl('');
                    }}
                    className={`p-1.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/50 bg-amber-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-full aspect-16/9 object-cover rounded-lg mb-1"
                    />
                    <span className="text-[11px] font-medium text-stone-800 block truncate">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="Or paste custom image URL (https://...)"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Date, Time & Venue */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2 flex items-center gap-2">
            <span>3. Date, Time & Location</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Event Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              />
              {errors.date && <p className="text-xs text-red-600 mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              />
              {errors.startTime && <p className="text-xs text-red-600 mt-1">{errors.startTime}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                End Time *
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400 ${
                  errors.endTime ? 'border-red-400 bg-red-50/30' : 'border-stone-200'
                }`}
              />
              {errors.endTime && <p className="text-xs text-red-600 mt-1">{errors.endTime}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={!isOnline}
                  onChange={() => setIsOnline(false)}
                  className="accent-amber-500 text-amber-500 focus:ring-amber-500"
                />
                <span>In-person Campus Venue</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={isOnline}
                  onChange={() => setIsOnline(true)}
                  className="accent-amber-500 text-amber-500 focus:ring-amber-500"
                />
                <span>Online / Virtual Event</span>
              </label>
            </div>

            {!isOnline ? (
              <LocationMapPicker
                coordinates={coordinates}
                onChangeCoordinates={setCoordinates}
                venueName={venueName}
                onChangeVenueName={(v) => {
                  setVenueName(v);
                  setLocation(roomNumber ? `${v} - ${roomNumber}` : v);
                }}
                address={address}
                onChangeAddress={setAddress}
                roomNumber={roomNumber}
                onChangeRoomNumber={(r) => {
                  setRoomNumber(r);
                  setLocation(r ? `${venueName} - ${r}` : venueName);
                }}
                arrivalInstructions={arrivalInstructions}
                onChangeArrivalInstructions={setArrivalInstructions}
              />
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Online Meeting Link / Virtual Platform *
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Online via Microsoft Teams / Zoom (Link provided to registered attendees)"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400 ${
                    errors.location ? 'border-red-400 bg-red-50/30' : 'border-stone-200'
                  }`}
                />
                <p className="text-[11px] text-stone-500">
                  Online events do not display on the interactive campus map.
                </p>
                {errors.location && <p className="text-xs text-red-600 mt-1">{errors.location}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Registration, Admission & Accessibility */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2 flex items-center gap-2">
            <span>4. Registration & Requirements</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Official Registration URL *
              </label>
              <input
                type="url"
                value={registrationUrl}
                onChange={(e) => setRegistrationUrl(e.target.value)}
                placeholder="https://clubs.uwaterloo.ca/event/123"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400 ${
                  errors.registrationUrl ? 'border-red-400 bg-red-50/30' : 'border-stone-200'
                }`}
              />
              {errors.registrationUrl && <p className="text-xs text-red-600 mt-1">{errors.registrationUrl}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Registration Deadline (Optional)
              </label>
              <input
                type="text"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                placeholder="e.g. 2026-10-29 23:59"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Admission Price
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFree(true);
                    setPrice('Free');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    isFree ? 'bg-stone-950 text-amber-300 border-stone-950 font-bold' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Free Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFree(false);
                    if (price === 'Free') setPrice('$5.00');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    !isFree ? 'bg-stone-950 text-amber-300 border-stone-950 font-bold' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Ticketed / Paid
                </button>
                {!isFree && (
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="$5.00"
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Eligibility & Restrictions
              </label>
              <input
                type="text"
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
                placeholder="e.g. Open to all UW students. WatCard required."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Accessibility Information (Optional)
            </label>
            <input
              type="text"
              value={accessibility}
              onChange={(e) => setAccessibility(e.target.value)}
              placeholder="e.g. Elevators available at West entrance, quiet sensory lounge in room 202."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-400"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium text-xs sm:text-sm flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4 text-stone-500" />
            <span>Save Draft</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenPreview}
              className="px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-medium text-xs sm:text-sm flex items-center gap-2 transition-colors"
            >
              <Eye className="w-4 h-4 text-stone-500" />
              <span>Preview</span>
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-98 text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Publish Event</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      {/* Live Preview Modal */}
      {previewEvent && (
        <EventDetailModal
          isOpen={Boolean(previewEvent)}
          event={previewEvent}
          onClose={() => setPreviewEvent(null)}
        />
      )}
    </div>
  );
};
