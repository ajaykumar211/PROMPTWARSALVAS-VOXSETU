import { Report } from '../types/index.ts';
import { calculatePriorityScore, determinePriorityBand, computeTargetDueDate } from '../utils/priority.ts';

export function generateSampleReports(): Report[] {
  const baseLat = 12.9141;
  const baseLon = 74.8560;
  const now = new Date('2026-10-29T20:00:00Z').getTime();

  const rawSeeds: Array<{
    trackingCode: string;
    text: string;
    lang: string;
    summary_en: string;
    summary_user: string;
    category: Report['category'];
    offsetLat: number;
    offsetLon: number;
    factors: Report['factors'];
    status: Report['status'];
    assignedTeam: Report['assignedTeam'];
    ageHours: number;
    duplicateOfTrackingCode?: string;
    duplicateConfidence?: number;
    duplicateReason?: string;
    affectedCount?: number;
    notes?: Array<{ note: string; citizenMsg: string; hoursAgo: number; status: Report['status'] }>;
  }> = [
    // --- 3 URGENT SAFETY ISSUES (Critical) ---
    {
      trackingCode: 'VS-9M2K1',
      text: 'Open manhole near St. Aloysius School gate on Light House Hill Road. No barricade or warning sign. School kids walking right next to it.',
      lang: 'en',
      summary_en: 'Open manhole without barricades directly outside school gate.',
      summary_user: 'Open manhole without barricades directly outside school gate.',
      category: 'Drainage',
      offsetLat: 0.0012,
      offsetLon: -0.0015,
      factors: {
        safetyRisk: { score: 5, reason: 'Deep open chamber posing severe fall and fatality hazard for school children.' },
        peopleAffected: { score: 5, reason: 'Hundreds of students and parents pass this gate daily.' },
        vulnerableLocation: { score: 5, reason: 'Directly in front of a primary school gate.' },
        recurrence: { score: 3, reason: 'Cover was reportedly dislodged during yesterday evening maintenance.' },
        durationOrWorsening: { score: 4, reason: 'Uncovered for over 18 hours with morning school rush approaching.' },
      },
      status: 'Assigned',
      assignedTeam: 'Drainage',
      ageHours: 3,
      affectedCount: 14,
      notes: [
        { note: 'Received high urgency report, safety barricade team dispatched immediately.', citizenMsg: 'Our drainage safety team has been alerted and is rushing to secure the manhole.', hoursAgo: 2, status: 'Assigned' }
      ]
    },
    {
      trackingCode: 'VS-4X8L9',
      text: 'Live electric wire hanging down from transformer pole right in front of Central Market vegetable stalls, sparking in the wind.',
      lang: 'en',
      summary_en: 'Live hanging electric wire sparking near busy market stalls.',
      summary_user: 'Live hanging electric wire sparking near busy market stalls.',
      category: 'Streetlight',
      offsetLat: -0.0031,
      offsetLon: 0.0022,
      factors: {
        safetyRisk: { score: 5, reason: 'High-voltage exposed cable with active sparking in pedestrian path.' },
        peopleAffected: { score: 5, reason: 'Crowded vegetable market with thousands of daily shoppers.' },
        vulnerableLocation: { score: 5, reason: 'Dense commercial market area.' },
        recurrence: { score: 2, reason: 'First report from this transformer pole.' },
        durationOrWorsening: { score: 4, reason: 'Sparking intensified following gusty afternoon winds.' },
      },
      status: 'In progress',
      assignedTeam: 'Electrical',
      ageHours: 2,
      affectedCount: 22,
      notes: [
        { note: 'Feed cut-off initiated at sub-station 4B, line repair crew on-site.', citizenMsg: 'Power to the line was disconnected and our repair crew is on-site fixing the wire.', hoursAgo: 1, status: 'In progress' }
      ]
    },
    {
      trackingCode: 'VS-6P1R3',
      text: 'Flooded railway underpass at Padil with 3 feet deep stagnant muddy water. Auto rickshaw broke down inside, pedestrian walk submerged.',
      lang: 'en',
      summary_en: 'Flooded underpass with 3ft water, auto stranded and footway submerged.',
      summary_user: 'Flooded underpass with 3ft water, auto stranded and footway submerged.',
      category: 'Waterlogging',
      offsetLat: 0.0055,
      offsetLon: 0.0061,
      factors: {
        safetyRisk: { score: 5, reason: 'Submerged vehicles and risk of drowning/electrocution in deep turbid water.' },
        peopleAffected: { score: 4, reason: 'Major arterial connection between industrial zone and city center.' },
        vulnerableLocation: { score: 4, reason: 'Key transportation bottleneck underpass.' },
        recurrence: { score: 4, reason: 'Known waterlogging sink during every spell of rainfall.' },
        durationOrWorsening: { score: 4, reason: 'Water level rising as runoff continues from adjacent hill slope.' },
      },
      status: 'Assigned',
      assignedTeam: 'Roads',
      ageHours: 4,
      affectedCount: 19,
      notes: [
        { note: 'Dewatering pump truck 12 assigned to Padil underpass.', citizenMsg: 'A dewatering pump truck has been assigned and is heading to the underpass.', hoursAgo: 2, status: 'Assigned' }
      ]
    },

    // --- 5 CLUSTERED REPORTS FORMING A HIGH-SCORE HOTSPOT ON K.S. RAO ROAD ---
    {
      trackingCode: 'VS-HOT-01',
      text: 'Heavy waterlogging outside City Centre Mall on K.S. Rao Road. Water entering shop fronts.',
      lang: 'en',
      summary_en: 'Heavy waterlogging outside shopping mall entering storefronts.',
      summary_user: 'Heavy waterlogging outside shopping mall entering storefronts.',
      category: 'Waterlogging',
      offsetLat: 0.0020,
      offsetLon: 0.0010,
      factors: {
        safetyRisk: { score: 3, reason: 'Slippery pedestrian walkway and traffic slowing.' },
        peopleAffected: { score: 4, reason: 'Busy commercial street with dozens of commercial shops.' },
        vulnerableLocation: { score: 4, reason: 'Main commercial hub and mall entrance.' },
        recurrence: { score: 3, reason: 'Repeated ponding whenever rainfall exceeds 10mm.' },
        durationOrWorsening: { score: 3, reason: 'Water has accumulated for 4 hours.' },
      },
      status: 'Under review',
      assignedTeam: null,
      ageHours: 6,
      affectedCount: 8,
    },
    {
      trackingCode: 'VS-HOT-02',
      text: 'Stormwater drain completely choked with plastic bottles and debris near K.S. Rao Road junction.',
      lang: 'en',
      summary_en: 'Stormwater drain completely choked with plastic debris near junction.',
      summary_user: 'Stormwater drain completely choked with plastic debris near junction.',
      category: 'Drainage',
      offsetLat: 0.0022,
      offsetLon: 0.0012,
      factors: {
        safetyRisk: { score: 3, reason: 'Blockage causes immediate backflow and flooding onto roadway.' },
        peopleAffected: { score: 4, reason: 'Affects drainage for the entire junction.' },
        vulnerableLocation: { score: 4, reason: 'Major intersection.' },
        recurrence: { score: 4, reason: 'Frequent dumping of commercial waste into culvert.' },
        durationOrWorsening: { score: 3, reason: 'Backflow expanding across two lanes.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 5,
      affectedCount: 6,
    },
    {
      trackingCode: 'VS-HOT-03',
      text: 'Severe asphalt erosion and deep trench created by water overflow on K.S. Rao Road near junction.',
      lang: 'en',
      summary_en: 'Deep road trench formed by water erosion near main junction.',
      summary_user: 'Deep road trench formed by water erosion near main junction.',
      category: 'Road damage',
      offsetLat: 0.0019,
      offsetLon: 0.0011,
      factors: {
        safetyRisk: { score: 4, reason: 'Hidden trench in dirty water causing two-wheeler skids.' },
        peopleAffected: { score: 4, reason: 'High traffic density route with frequent scooter traffic.' },
        vulnerableLocation: { score: 4, reason: 'Busy central junction.' },
        recurrence: { score: 3, reason: 'Patched last month but washed away again.' },
        durationOrWorsening: { score: 4, reason: 'Trench widening as heavy buses brake over the hole.' },
      },
      status: 'Under review',
      assignedTeam: null,
      ageHours: 4,
      affectedCount: 11,
    },
    {
      trackingCode: 'VS-HOT-04',
      text: 'ಕೆ.ಎಸ್. ರಾವ್ ರಸ್ತೆಯ ಅಂಗಡಿಗಳ ಮುಂದೆ ಚರಂಡಿ ಕಟ್ಟಿಕೊಂಡು ಕೊಳಚೆ ನೀರು ಹರಿಯುತ್ತಿದೆ.',
      lang: 'kn',
      summary_en: 'Drain blocked in front of shops on K.S. Rao Road with filthy sewage overflow.',
      summary_user: 'ಕೆ.ಎಸ್. ರಾವ್ ರಸ್ತೆಯಲ್ಲಿ ಚರಂಡಿ ಕಟ್ಟಿಕೊಂಡು ನೀರು ರಸ್ತೆಗೆ ಬರುತ್ತಿದೆ.',
      category: 'Drainage',
      offsetLat: 0.0021,
      offsetLon: 0.0013,
      factors: {
        safetyRisk: { score: 3, reason: 'Foul contaminated wastewater flowing into food stalls.' },
        peopleAffected: { score: 4, reason: 'Pedestrians and diners in market street.' },
        vulnerableLocation: { score: 4, reason: 'Food establishment cluster.' },
        recurrence: { score: 3, reason: 'Regular occurrence during monsoon spells.' },
        durationOrWorsening: { score: 3, reason: 'Odor and pool expanding continuously.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 8,
      affectedCount: 5,
    },
    {
      trackingCode: 'VS-HOT-05',
      text: 'Water ponding 1 foot deep right at bus stop on K.S. Rao road, commuters forced to stand in traffic lane.',
      lang: 'en',
      summary_en: 'One-foot water ponding at bus stop forcing commuters onto traffic lane.',
      summary_user: 'One-foot water ponding at bus stop forcing commuters onto traffic lane.',
      category: 'Waterlogging',
      offsetLat: 0.0023,
      offsetLon: 0.0010,
      factors: {
        safetyRisk: { score: 4, reason: 'Commuters standing in vehicle path due to flooded shelter.' },
        peopleAffected: { score: 4, reason: 'Hundreds waiting for city buses.' },
        vulnerableLocation: { score: 4, reason: 'Public transit bus stop.' },
        recurrence: { score: 3, reason: 'Drain inlet is raised higher than the curb.' },
        durationOrWorsening: { score: 3, reason: 'Unchanged for 5 hours.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 7,
      affectedCount: 9,
    },

    // --- 8 INDIC LANGUAGE REPORTS (Kannada, Hindi, Telugu) ---
    {
      trackingCode: 'VS-KN-01',
      text: 'ಹಂಪನಕಟ್ಟಾ ಸಿಗ್ನಲ್ ಬಳಿ ಬೀದಿ ದೀಪಗಳು ಕಳೆದ ಮೂರು ದಿನಗಳಿಂದ ಬೆಳಗುತ್ತಿಲ್ಲ. ರಾತ್ರಿ ವೇಳೆ ಕತ್ತಲಲ್ಲಿ ಅಪಘಾತಗಳು ಸಂಭವಿಸುತ್ತಿವೆ.',
      lang: 'kn',
      summary_en: 'Streetlights not working for 3 days near Hampankatta signal causing nighttime accidents.',
      summary_user: 'ಹಂಪನಕಟ್ಟಾ ಸಿಗ್ನಲ್ ಬಳಿ ಬೀದಿ ದೀಪಗಳು ಕಳೆದ ಮೂರು ದಿನಗಳಿಂದ ಉರಿಯುತ್ತಿಲ್ಲ.',
      category: 'Streetlight',
      offsetLat: -0.0010,
      offsetLon: -0.0008,
      factors: {
        safetyRisk: { score: 4, reason: 'Pitch dark intersection leading to vehicular collisions.' },
        peopleAffected: { score: 4, reason: 'Major city intersection with round-the-clock traffic.' },
        vulnerableLocation: { score: 4, reason: 'Hampankatta traffic signal junction.' },
        recurrence: { score: 2, reason: 'Bulb/feeder trip over recent weekend.' },
        durationOrWorsening: { score: 3, reason: 'Dark for 72 continuous hours.' },
      },
      status: 'Assigned',
      assignedTeam: 'Electrical',
      ageHours: 36,
      affectedCount: 7,
      notes: [
        { note: 'Control box relay fault identified, replacement timer ordered.', citizenMsg: 'Our electrical team identified a relay fault and is installing a replacement part today.', hoursAgo: 12, status: 'Assigned' }
      ]
    },
    {
      trackingCode: 'VS-KN-02',
      text: 'ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆ ಎದುರು ಕಸದ ತೊಟ್ಟಿ ತುಂಬಿ ರಸ್ತೆಯ ಮೇಲೆ ಹರಡಿದೆ. ವಿಪರೀತ ದುರ್ವಾಸನೆ ಮತ್ತು ನೊಣಗಳು ಹರಡುತ್ತಿವೆ.',
      lang: 'kn',
      summary_en: 'Overflowing garbage bin spilling onto road opposite Government Hospital causing disease vector risk.',
      summary_user: 'ಸರ್ಕಾರಿ ಆಸ್ಪತ್ರೆ ಎದುರು ಕಸದ ತೊಟ್ಟಿ ತುಂಬಿ ರಸ್ತೆಗೆ ಚೆಲ್ಲಿದೆ.',
      category: 'Garbage',
      offsetLat: -0.0022,
      offsetLon: 0.0018,
      factors: {
        safetyRisk: { score: 4, reason: 'Medical/organic waste decomposing right beside hospital gate.' },
        peopleAffected: { score: 4, reason: 'Patients, visitors, and hospital staff walking past.' },
        vulnerableLocation: { score: 5, reason: 'District Government Hospital entrance.' },
        recurrence: { score: 4, reason: 'Bin truck missed collection for two cycles.' },
        durationOrWorsening: { score: 4, reason: 'Dogs and cattle scattering waste into hospital lane.' },
      },
      status: 'In progress',
      assignedTeam: 'Sanitation',
      ageHours: 18,
      affectedCount: 16,
      notes: [
        { note: 'Compact loader sent for clearance; deep sanitization ordered.', citizenMsg: 'Sanitation vehicle is on site clearing the garbage and sanitizing the area.', hoursAgo: 2, status: 'In progress' }
      ]
    },
    {
      trackingCode: 'VS-HI-01',
      text: 'सेंट्रल बस स्टैंड के पास मुख्य सड़क पर 2 फीट गहरा गड्ढा है। कल रात एक बाइक सवार गिरकर घायल हो गया।',
      lang: 'hi',
      summary_en: 'Two-foot deep pothole on main road near Central Bus Stand; motorcyclist injured last night.',
      summary_user: 'सेंट्रल बस स्टैंड के पास मुख्य सड़क पर गहरा गड्ढा है।',
      category: 'Road damage',
      offsetLat: 0.0005,
      offsetLon: -0.0025,
      factors: {
        safetyRisk: { score: 5, reason: 'Severe pothole already caused serious personal injury.' },
        peopleAffected: { score: 4, reason: 'Central bus terminal route carrying heavy transit vehicles.' },
        vulnerableLocation: { score: 4, reason: 'Bus station exit lane.' },
        recurrence: { score: 3, reason: 'Patch failed after recent heavy monsoon showers.' },
        durationOrWorsening: { score: 4, reason: 'Edge crumbled into a steep crater.' },
      },
      status: 'Assigned',
      assignedTeam: 'Roads',
      ageHours: 14,
      affectedCount: 12,
      notes: [
        { note: 'Cold mix asphalt team assigned for rapid morning patch.', citizenMsg: 'Our road repair team has been assigned to patch the pothole with rapid asphalt.', hoursAgo: 5, status: 'Assigned' }
      ]
    },
    {
      trackingCode: 'VS-HI-02',
      text: 'सब्जी मंडी के पीछे नाले की दीवार टूट गई है और गंदा पानी दुकानों की तरफ बह रहा है।',
      lang: 'hi',
      summary_en: 'Drain retaining wall collapsed behind vegetable market, sewage flooding towards stalls.',
      summary_user: 'सब्जी मंडी के पीछे नाले की दीवार टूट गई है।',
      category: 'Drainage',
      offsetLat: -0.0035,
      offsetLon: 0.0028,
      factors: {
        safetyRisk: { score: 3, reason: 'Structural collapse of drain masonry; contamination of produce.' },
        peopleAffected: { score: 3, reason: 'Local market vendors and nearby residents.' },
        vulnerableLocation: { score: 3, reason: 'Food market zone.' },
        recurrence: { score: 2, reason: 'Recent masonry crack expanded.' },
        durationOrWorsening: { score: 4, reason: 'Earth slipping into the channel.' },
      },
      status: 'Under review',
      assignedTeam: null,
      ageHours: 22,
      affectedCount: 4,
    },
    {
      trackingCode: 'VS-HI-03',
      text: 'नेहरू मैदान के पास स्ट्रीट लाइट का खंभा झुक गया है और कभी भी गिर सकता है।',
      lang: 'hi',
      summary_en: 'Streetlight pole tilted precariously near Nehru Maidan and could fall.',
      summary_user: 'नेहरू मैदान के पास स्ट्रीट लाइट का खंभा खतरनाक रूप से झुक गया है।',
      category: 'Streetlight',
      offsetLat: 0.0038,
      offsetLon: -0.0019,
      factors: {
        safetyRisk: { score: 4, reason: 'Heavy iron pole at risk of falling on road or pedestrians.' },
        peopleAffected: { score: 3, reason: 'Walkers and players visiting sports ground.' },
        vulnerableLocation: { score: 3, reason: 'Public park and playground perimeter.' },
        recurrence: { score: 1, reason: 'Base hit by vehicle during night.' },
        durationOrWorsening: { score: 4, reason: 'Tilt angle visibly increasing under tension.' },
      },
      status: 'Assigned',
      assignedTeam: 'Electrical',
      ageHours: 8,
      affectedCount: 6,
    },
    {
      trackingCode: 'VS-TE-01',
      text: 'గాంధీ పార్క్ ఎదురుగా ఉన్న డ్రైనేజీ మూత పగిలిపోయింది. వృద్ధులు మరియు పిల్లలు నడిచే దారిలో ఇది చాలా ప్రమాదకరం.',
      lang: 'te',
      summary_en: 'Drain slab cracked and broken in front of Gandhi Park, endangering elderly and children.',
      summary_user: 'గాంధీ పార్క్ ఎదురుగా డ్రైనేజీ మూత పగిలిపోయింది.',
      category: 'Drainage',
      offsetLat: 0.0018,
      offsetLon: -0.0032,
      factors: {
        safetyRisk: { score: 4, reason: 'Cracked concrete slab collapsing under foot pressure.' },
        peopleAffected: { score: 3, reason: 'Elderly citizens walking to park.' },
        vulnerableLocation: { score: 4, reason: 'Directly at public park entrance.' },
        recurrence: { score: 2, reason: 'Cracked last week; now broken through.' },
        durationOrWorsening: { score: 3, reason: 'Fragmented edges widening hole.' },
      },
      status: 'Assigned',
      assignedTeam: 'Drainage',
      ageHours: 16,
      affectedCount: 5,
    },
    {
      trackingCode: 'VS-TE-02',
      text: 'రైల్వే స్టేషన్ రోడ్డులో పెద్ద ఎత్తున వ్యర్థాలు మరియు నిర్మాణ శిధిలాలు రోడ్డుపై పడేశారు. రాకపోకలకు తీవ్ర అంతరాయం.',
      lang: 'te',
      summary_en: 'Construction debris and garbage dumped on Railway Station road blocking traffic lane.',
      summary_user: 'రైల్వే స్టేషన్ రోడ్డులో నిర్మాణ వ్యర్థాలు మరియు చెత్త వేయబడింది.',
      category: 'Garbage',
      offsetLat: -0.0015,
      offsetLon: -0.0040,
      factors: {
        safetyRisk: { score: 3, reason: 'Concrete debris causing traffic bottlenecks and tire punctures.' },
        peopleAffected: { score: 4, reason: 'Key access route to Mangalore Central station.' },
        vulnerableLocation: { score: 4, reason: 'Transit corridor.' },
        recurrence: { score: 2, reason: 'Illegal nighttime dumping.' },
        durationOrWorsening: { score: 2, reason: 'Spread over 15 meters along the curb.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 10,
      affectedCount: 8,
    },
    {
      trackingCode: 'VS-KN-03',
      text: 'ಕಂಕನಾಡಿ ಮಾರುಕಟ್ಟೆ ಜಂಕ್ಷನ್‌ನಲ್ಲಿ ಡ್ರೈನೇಜ್ ಬ್ಲಾಕ್ ಆಗಿ ಕೊಳಕು ನೀರು ಇಡೀ ರಸ್ತೆಗೆ ನುಗ್ಗಿದೆ.',
      lang: 'kn',
      summary_en: 'Drainage blockage at Kankanady market junction flooding foul water across road.',
      summary_user: 'ಕಂಕನಾಡಿ ಮಾರುಕಟ್ಟೆ ಜಂಕ್ಷನ್‌ನಲ್ಲಿ ಕೊಳಚೆ ನೀರು ರಸ್ತೆಗೆ ನುಗ್ಗಿದೆ.',
      category: 'Drainage',
      offsetLat: -0.0045,
      offsetLon: 0.0035,
      factors: {
        safetyRisk: { score: 3, reason: 'Sanitation and hygiene hazard on commercial walkway.' },
        peopleAffected: { score: 4, reason: 'Market visitors and shopkeepers.' },
        vulnerableLocation: { score: 3, reason: 'Market zone.' },
        recurrence: { score: 3, reason: 'Known blockage point during high tide and rain.' },
        durationOrWorsening: { score: 3, reason: 'Stagnant wastewater for over 6 hours.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 9,
      affectedCount: 7,
    },

    // --- 6 DELIBERATE DUPLICATES (linked to parent reports) ---
    {
      trackingCode: 'VS-DUP-01',
      text: 'Manhole cover missing outside St. Aloysius School gate! Very dangerous for kids.',
      lang: 'en',
      summary_en: 'Missing manhole cover outside St. Aloysius School.',
      summary_user: 'Missing manhole cover outside St. Aloysius School.',
      category: 'Drainage',
      offsetLat: 0.0013,
      offsetLon: -0.0014,
      factors: {
        safetyRisk: { score: 5, reason: 'Open manhole near school.' },
        peopleAffected: { score: 5, reason: 'School pupils.' },
        vulnerableLocation: { score: 5, reason: 'School gate.' },
        recurrence: { score: 3, reason: 'Ongoing hazard.' },
        durationOrWorsening: { score: 4, reason: 'Dangerous.' },
      },
      status: 'Assigned',
      assignedTeam: 'Drainage',
      ageHours: 2,
      duplicateOfTrackingCode: 'VS-9M2K1',
      duplicateConfidence: 0.94,
      duplicateReason: 'Identical location (within 20m of school gate) reporting the same open manhole chamber.',
    },
    {
      trackingCode: 'VS-DUP-02',
      text: 'Electric wire sparking near Central Market vegetables, someone could get shocked.',
      lang: 'en',
      summary_en: 'Sparking wire near Central Market vegetable stands.',
      summary_user: 'Sparking wire near Central Market vegetable stands.',
      category: 'Streetlight',
      offsetLat: -0.0030,
      offsetLon: 0.0021,
      factors: {
        safetyRisk: { score: 5, reason: 'Electric shock hazard.' },
        peopleAffected: { score: 5, reason: 'Market shoppers.' },
        vulnerableLocation: { score: 5, reason: 'Vegetable stalls.' },
        recurrence: { score: 2, reason: 'Sparking wire.' },
        durationOrWorsening: { score: 4, reason: 'Live wire.' },
      },
      status: 'In progress',
      assignedTeam: 'Electrical',
      ageHours: 1,
      duplicateOfTrackingCode: 'VS-4X8L9',
      duplicateConfidence: 0.96,
      duplicateReason: 'Reports the exact same exposed wire dangling from the market transformer.',
    },
    {
      trackingCode: 'VS-DUP-03',
      text: 'Padil underpass is completely waterlogged, vehicles cannot pass.',
      lang: 'en',
      summary_en: 'Padil railway underpass flooded, traffic halted.',
      summary_user: 'Padil railway underpass flooded, traffic halted.',
      category: 'Waterlogging',
      offsetLat: 0.0054,
      offsetLon: 0.0062,
      factors: {
        safetyRisk: { score: 5, reason: 'Deep water.' },
        peopleAffected: { score: 4, reason: 'Underpass commuters.' },
        vulnerableLocation: { score: 4, reason: 'Railway underpass.' },
        recurrence: { score: 4, reason: 'Flooding.' },
        durationOrWorsening: { score: 4, reason: 'Stagnant water.' },
      },
      status: 'Assigned',
      assignedTeam: 'Roads',
      ageHours: 3,
      duplicateOfTrackingCode: 'VS-6P1R3',
      duplicateConfidence: 0.92,
      duplicateReason: 'Same railway underpass inundation described at identical coordinates.',
    },
    {
      trackingCode: 'VS-DUP-04',
      text: 'K.S. Rao road drain overflow in front of mall, road flooded with dirty water.',
      lang: 'en',
      summary_en: 'Drain overflow outside mall on K.S. Rao road.',
      summary_user: 'Drain overflow outside mall on K.S. Rao road.',
      category: 'Waterlogging',
      offsetLat: 0.0021,
      offsetLon: 0.0009,
      factors: {
        safetyRisk: { score: 3, reason: 'Flooded road.' },
        peopleAffected: { score: 4, reason: 'Shoppers and motorists.' },
        vulnerableLocation: { score: 4, reason: 'Mall street.' },
        recurrence: { score: 3, reason: 'Water ponding.' },
        durationOrWorsening: { score: 3, reason: 'Water spreading.' },
      },
      status: 'Under review',
      assignedTeam: null,
      ageHours: 5,
      duplicateOfTrackingCode: 'VS-HOT-01',
      duplicateConfidence: 0.88,
      duplicateReason: 'Same flood water accumulation outside City Centre Mall reported 45 minutes apart.',
    },
    {
      trackingCode: 'VS-DUP-05',
      text: 'Deep crater on road near bus stand, huge pothole.',
      lang: 'en',
      summary_en: 'Huge pothole crater near central bus stand.',
      summary_user: 'Huge pothole crater near central bus stand.',
      category: 'Road damage',
      offsetLat: 0.0006,
      offsetLon: -0.0024,
      factors: {
        safetyRisk: { score: 5, reason: 'Dangerous pothole.' },
        peopleAffected: { score: 4, reason: 'Bus route traffic.' },
        vulnerableLocation: { score: 4, reason: 'Bus stand exit.' },
        recurrence: { score: 3, reason: 'Road crater.' },
        durationOrWorsening: { score: 4, reason: 'Broken asphalt.' },
      },
      status: 'Assigned',
      assignedTeam: 'Roads',
      ageHours: 11,
      duplicateOfTrackingCode: 'VS-HI-01',
      duplicateConfidence: 0.91,
      duplicateReason: 'Refers to the same hazardous road cavity near the Central Bus Stand.',
    },
    {
      trackingCode: 'VS-DUP-06',
      text: 'Garbage pile smelling bad outside district hospital.',
      lang: 'en',
      summary_en: 'Foul garbage pile outside hospital entrance.',
      summary_user: 'Foul garbage pile outside hospital entrance.',
      category: 'Garbage',
      offsetLat: -0.0023,
      offsetLon: 0.0019,
      factors: {
        safetyRisk: { score: 4, reason: 'Medical/organic waste.' },
        peopleAffected: { score: 4, reason: 'Hospital visitors.' },
        vulnerableLocation: { score: 5, reason: 'Hospital gate.' },
        recurrence: { score: 4, reason: 'Uncollected refuse.' },
        durationOrWorsening: { score: 4, reason: 'Foul odor.' },
      },
      status: 'In progress',
      assignedTeam: 'Sanitation',
      ageHours: 15,
      duplicateOfTrackingCode: 'VS-KN-02',
      duplicateConfidence: 0.89,
      duplicateReason: 'Duplicate notification for uncollected waste mound outside Government Hospital.',
    },

    // --- MORE CIVIC REPORTS TO REACH 40 TOTAL ACROSS VARIOUS STATUSES & DATES (0-14 days) ---
    {
      trackingCode: 'VS-8B4K2',
      text: 'Broken concrete drain slab on Car Street near Temple square, pedestrians tripping.',
      lang: 'en',
      summary_en: 'Broken drain slab causing tripping hazard near Temple square.',
      summary_user: 'Broken drain slab causing tripping hazard near Temple square.',
      category: 'Drainage',
      offsetLat: 0.0030,
      offsetLon: -0.0035,
      factors: {
        safetyRisk: { score: 3, reason: 'Tripping hazard for pedestrians.' },
        peopleAffected: { score: 3, reason: 'Devotees visiting temple.' },
        vulnerableLocation: { score: 3, reason: 'Temple pedestrian walkway.' },
        recurrence: { score: 2, reason: 'Broken during delivery unloading.' },
        durationOrWorsening: { score: 2, reason: 'Static defect.' },
      },
      status: 'Resolved',
      assignedTeam: 'Drainage',
      ageHours: 72,
      affectedCount: 4,
      notes: [
        { note: 'Pre-cast reinforced slab replaced and leveled flush with pavement.', citizenMsg: 'A new reinforced concrete slab has been installed and leveled safely.', hoursAgo: 24, status: 'Resolved' }
      ]
    },
    {
      trackingCode: 'VS-2W9M7',
      text: 'Streetlights flickering continuously and going dark intermittently on Kadri Park road.',
      lang: 'en',
      summary_en: 'Flickering streetlights on Kadri Park road creating dark spots.',
      summary_user: 'Flickering streetlights on Kadri Park road creating dark spots.',
      category: 'Streetlight',
      offsetLat: 0.0045,
      offsetLon: 0.0032,
      factors: {
        safetyRisk: { score: 2, reason: 'Dim lighting for evening joggers and women walking.' },
        peopleAffected: { score: 3, reason: 'Park visitors.' },
        vulnerableLocation: { score: 3, reason: 'Park promenade.' },
        recurrence: { score: 2, reason: 'Loose contact in luminaire arm.' },
        durationOrWorsening: { score: 2, reason: 'Happening every evening.' },
      },
      status: 'Resolved',
      assignedTeam: 'Electrical',
      ageHours: 96,
      affectedCount: 3,
      notes: [
        { note: 'Capacitors replaced across 4 poles on Kadri road.', citizenMsg: 'Our team replaced the faulty capacitors and all lights are now burning bright.', hoursAgo: 48, status: 'Resolved' }
      ]
    },
    {
      trackingCode: 'VS-7V3Q5',
      text: 'Construction debris dumped overnight on footpath near Bunts Hostel circle.',
      lang: 'en',
      summary_en: 'Construction debris dumped on footpath forcing pedestrians onto roadway.',
      summary_user: 'Construction debris dumped on footpath forcing pedestrians onto roadway.',
      category: 'Garbage',
      offsetLat: 0.0010,
      offsetLon: 0.0025,
      factors: {
        safetyRisk: { score: 2, reason: 'Pedestrians walking in vehicle lanes.' },
        peopleAffected: { score: 3, reason: 'High foot-traffic student junction.' },
        vulnerableLocation: { score: 3, reason: 'Hostel and college area.' },
        recurrence: { score: 1, reason: 'One-off illegal dump.' },
        durationOrWorsening: { score: 2, reason: 'Debris piles blocking 10 meters.' },
      },
      status: 'In progress',
      assignedTeam: 'Sanitation',
      ageHours: 28,
      affectedCount: 7,
      notes: [
        { note: 'JCB booked for 11 PM night clearance.', citizenMsg: 'A loader vehicle has been scheduled to remove the debris tonight.', hoursAgo: 10, status: 'In progress' }
      ]
    },
    {
      trackingCode: 'VS-5T1N8',
      text: 'Pothole patch broke open again on Balmatta road near petrol pump after 2 days of rain.',
      lang: 'en',
      summary_en: 'Reopened pothole on Balmatta road causing vehicle jolts.',
      summary_user: 'Pothole patch broke open again on Balmatta road near petrol pump.',
      category: 'Road damage',
      offsetLat: -0.0018,
      offsetLon: 0.0005,
      factors: {
        safetyRisk: { score: 3, reason: 'Sudden braking by cars in rain.' },
        peopleAffected: { score: 4, reason: 'Primary commuter artery.' },
        vulnerableLocation: { score: 3, reason: 'Busy commercial road.' },
        recurrence: { score: 4, reason: 'Failed cold-mix patch.' },
        durationOrWorsening: { score: 3, reason: 'Washed out again.' },
      },
      status: 'Reopened',
      assignedTeam: 'Roads',
      ageHours: 48,
      affectedCount: 15,
      notes: [
        { note: 'Citizen reported cold mix failure. Reopening ticket for hot-mix bitumen overlay.', citizenMsg: 'We reopened your report for a permanent hot-mix asphalt repair.', hoursAgo: 8, status: 'Reopened' }
      ]
    },
    {
      trackingCode: 'VS-3Y8J4',
      text: 'Water meter box cover missing in sidewalk near Ladyhill circle, deep hole exposed.',
      lang: 'en',
      summary_en: 'Missing utility box cover leaving opening on sidewalk.',
      summary_user: 'Missing utility box cover leaving opening on sidewalk.',
      category: 'Other',
      offsetLat: 0.0062,
      offsetLon: -0.0018,
      factors: {
        safetyRisk: { score: 3, reason: 'Foot trap for unwary pedestrians.' },
        peopleAffected: { score: 2, reason: 'Sidewalk foot-traffic.' },
        vulnerableLocation: { score: 3, reason: 'Near church and school.' },
        recurrence: { score: 2, reason: 'Plastic lid broken.' },
        durationOrWorsening: { score: 2, reason: 'Hole marked with stick.' },
      },
      status: 'Under review',
      assignedTeam: null,
      ageHours: 54,
      affectedCount: 2,
    },
    {
      trackingCode: 'VS-1K9F2',
      text: 'Tree branch fallen across low tension power cable on Urwa market lane.',
      lang: 'en',
      summary_en: 'Heavy tree branch resting on low-tension cable on market lane.',
      summary_user: 'Heavy tree branch resting on low-tension cable on market lane.',
      category: 'Streetlight',
      offsetLat: 0.0050,
      offsetLon: -0.0028,
      factors: {
        safetyRisk: { score: 4, reason: 'Tension on power cable could snap lines.' },
        peopleAffected: { score: 3, reason: 'Local neighborhood market.' },
        vulnerableLocation: { score: 3, reason: 'Narrow residential street.' },
        recurrence: { score: 1, reason: 'Branch fell during storm.' },
        durationOrWorsening: { score: 3, reason: 'Cable sagging to 8 feet.' },
      },
      status: 'Assigned',
      assignedTeam: 'Electrical',
      ageHours: 19,
      affectedCount: 6,
    },
    {
      trackingCode: 'VS-9C4L8',
      text: 'Illegal dumping of fish waste behind fish market on Bunder port road, severe foul smell.',
      lang: 'en',
      summary_en: 'Fish waste dumped behind port road market causing severe stench.',
      summary_user: 'Fish waste dumped behind port road market causing severe stench.',
      category: 'Garbage',
      offsetLat: -0.0048,
      offsetLon: -0.0010,
      factors: {
        safetyRisk: { score: 3, reason: 'Public health and maggots issue.' },
        peopleAffected: { score: 3, reason: 'Port workers and fishermen.' },
        vulnerableLocation: { score: 3, reason: 'Dockside commercial area.' },
        recurrence: { score: 4, reason: 'Recurring after market closure.' },
        durationOrWorsening: { score: 4, reason: 'Extreme odor in midday heat.' },
      },
      status: 'In progress',
      assignedTeam: 'Sanitation',
      ageHours: 12,
      affectedCount: 9,
    },
    {
      trackingCode: 'VS-4B7N1',
      text: 'Large puddle of oily dirty water on road outside mechanic row in Kottara Chowki.',
      lang: 'en',
      summary_en: 'Oily water accumulation outside mechanic shops causing skidding risk.',
      summary_user: 'Oily water accumulation outside mechanic shops causing skidding risk.',
      category: 'Waterlogging',
      offsetLat: 0.0070,
      offsetLon: 0.0015,
      factors: {
        safetyRisk: { score: 3, reason: 'Oil on wet road lowers tire grip.' },
        peopleAffected: { score: 3, reason: 'Connecting road commuters.' },
        vulnerableLocation: { score: 2, reason: 'Automobile workshop area.' },
        recurrence: { score: 3, reason: 'Washing bay runoff.' },
        durationOrWorsening: { score: 2, reason: 'Constant puddle.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 65,
      affectedCount: 1,
    },
    {
      trackingCode: 'VS-6D2H9',
      text: 'Speed breaker white markings completely faded near Milagres Church, vehicles speeding.',
      lang: 'en',
      summary_en: 'Faded speed breaker markings near church creating collision hazard.',
      summary_user: 'Faded speed breaker markings near church creating collision hazard.',
      category: 'Road damage',
      offsetLat: -0.0008,
      offsetLon: 0.0012,
      factors: {
        safetyRisk: { score: 3, reason: 'Unmarked humps cause sudden hard braking.' },
        peopleAffected: { score: 4, reason: 'Church and school zone.' },
        vulnerableLocation: { score: 4, reason: 'Pedestrian church crossing.' },
        recurrence: { score: 2, reason: 'Paint worn away over 6 months.' },
        durationOrWorsening: { score: 2, reason: 'Completely invisible at night.' },
      },
      status: 'Assigned',
      assignedTeam: 'Roads',
      ageHours: 110,
      affectedCount: 8,
    },
    {
      trackingCode: 'VS-8S3W5',
      text: 'Sewage overflowing from manhole outside residential apartment in Bejai New Road.',
      lang: 'en',
      summary_en: 'Sewage overflowing from chamber onto residential street.',
      summary_user: 'Sewage overflowing from chamber onto residential street.',
      category: 'Drainage',
      offsetLat: 0.0035,
      offsetLon: 0.0040,
      factors: {
        safetyRisk: { score: 3, reason: 'Raw sewage overflow and contamination.' },
        peopleAffected: { score: 3, reason: '150 apartment residents.' },
        vulnerableLocation: { score: 2, reason: 'Residential lane.' },
        recurrence: { score: 3, reason: 'Main line surcharge.' },
        durationOrWorsening: { score: 3, reason: 'Continuous trickle.' },
      },
      status: 'In progress',
      assignedTeam: 'Drainage',
      ageHours: 14,
      affectedCount: 18,
    },
    {
      trackingCode: 'VS-2Z7V6',
      text: 'Graffiti defacing public health center exterior wall and direction boards.',
      lang: 'en',
      summary_en: 'Graffiti defacing health center signage and exterior wall.',
      summary_user: 'Graffiti defacing health center signage and exterior wall.',
      category: 'Other',
      offsetLat: -0.0032,
      offsetLon: -0.0022,
      factors: {
        safetyRisk: { score: 1, reason: 'Non-safety aesthetic issue.' },
        peopleAffected: { score: 2, reason: 'Health clinic visitors.' },
        vulnerableLocation: { score: 3, reason: 'Primary health clinic.' },
        recurrence: { score: 1, reason: 'Occurred over weekend.' },
        durationOrWorsening: { score: 1, reason: 'Stable defacement.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 85,
      affectedCount: 0,
    },
    {
      trackingCode: 'VS-5P4Q3',
      text: 'Overhead street lamp bracket rusted through and dangling in wind at Mangaladevi.',
      lang: 'en',
      summary_en: 'Rusted street lamp fixture dangling dangerously from pole.',
      summary_user: 'Rusted street lamp fixture dangling dangerously from pole.',
      category: 'Streetlight',
      offsetLat: -0.0060,
      offsetLon: 0.0010,
      factors: {
        safetyRisk: { score: 4, reason: 'Heavy glass fixture could drop on passersby.' },
        peopleAffected: { score: 3, reason: 'Temple road devotees.' },
        vulnerableLocation: { score: 3, reason: 'Pilgrim pathway.' },
        recurrence: { score: 2, reason: 'Severe coastal corrosion.' },
        durationOrWorsening: { score: 3, reason: 'Held by wiring alone.' },
      },
      status: 'Assigned',
      assignedTeam: 'Electrical',
      ageHours: 24,
      affectedCount: 5,
    },
    {
      trackingCode: 'VS-7L1K9',
      text: 'Roadside ditch filled with stagnant green water breeding thousands of mosquitoes.',
      lang: 'en',
      summary_en: 'Stagnant unlined ditch breeding mosquitoes near residential block.',
      summary_user: 'Stagnant unlined ditch breeding mosquitoes near residential block.',
      category: 'Drainage',
      offsetLat: 0.0028,
      offsetLon: 0.0052,
      factors: {
        safetyRisk: { score: 3, reason: 'Dengue and malaria transmission threat.' },
        peopleAffected: { score: 3, reason: 'Nearby colony residents.' },
        vulnerableLocation: { score: 2, reason: 'Suburban street.' },
        recurrence: { score: 4, reason: 'Never graded properly.' },
        durationOrWorsening: { score: 3, reason: 'Standing for two weeks.' },
      },
      status: 'Under review',
      assignedTeam: null,
      ageHours: 120,
      affectedCount: 11,
    },
    {
      trackingCode: 'VS-1F8M2',
      text: 'Dustbin damaged and wheels missing, waste thrown on ground in front of court building.',
      lang: 'en',
      summary_en: 'Broken public dustbin causing scattered garbage near district court.',
      summary_user: 'Broken public dustbin causing scattered garbage near district court.',
      category: 'Garbage',
      offsetLat: -0.0002,
      offsetLon: -0.0018,
      factors: {
        safetyRisk: { score: 2, reason: 'Litter scattering on walkway.' },
        peopleAffected: { score: 3, reason: 'Court visitors and lawyers.' },
        vulnerableLocation: { score: 3, reason: 'District court premises.' },
        recurrence: { score: 2, reason: 'Bin damaged last week.' },
        durationOrWorsening: { score: 2, reason: 'Ground heap growing.' },
      },
      status: 'Resolved',
      assignedTeam: 'Sanitation',
      ageHours: 140,
      affectedCount: 4,
      notes: [
        { note: 'New 240L wheelie bin installed with secure chain lock.', citizenMsg: 'We replaced the damaged dustbin with a brand new wheeled container.', hoursAgo: 50, status: 'Resolved' }
      ]
    },
    {
      trackingCode: 'VS-3X5T7',
      text: 'Road cave-in around telecommunication manhole cover on Falnir road.',
      lang: 'en',
      summary_en: 'Road subsidence forming depression around telecom chamber on Falnir road.',
      summary_user: 'Road subsidence forming depression around telecom chamber on Falnir road.',
      category: 'Road damage',
      offsetLat: -0.0028,
      offsetLon: -0.0005,
      factors: {
        safetyRisk: { score: 3, reason: 'Depression causes vehicle jolts and wheel misalignment.' },
        peopleAffected: { score: 3, reason: 'Commuters on Falnir route.' },
        vulnerableLocation: { score: 2, reason: 'Urban road.' },
        recurrence: { score: 2, reason: 'Backfill settling after fiber optic trenching.' },
        durationOrWorsening: { score: 3, reason: 'Sunk by 4 inches.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 70,
      affectedCount: 3,
    },
    {
      trackingCode: 'VS-9H2W4',
      text: 'Water pipeline burst spraying clean drinking water 10 feet into the air on Bendorewell road.',
      lang: 'en',
      summary_en: 'Main drinking water pipeline burst spraying water across Bendorewell road.',
      summary_user: 'Main drinking water pipeline burst spraying water across Bendorewell road.',
      category: 'Other',
      offsetLat: -0.0012,
      offsetLon: 0.0035,
      factors: {
        safetyRisk: { score: 3, reason: 'Wasting municipal water and flooding road surface.' },
        peopleAffected: { score: 4, reason: 'Water supply disrupted for 400 households.' },
        vulnerableLocation: { score: 3, reason: 'Key junction.' },
        recurrence: { score: 1, reason: 'Aging AC pipe rupture.' },
        durationOrWorsening: { score: 4, reason: 'High pressure leak flooding street.' },
      },
      status: 'In progress',
      assignedTeam: 'Drainage',
      ageHours: 5,
      affectedCount: 25,
      notes: [
        { note: 'Valve 3 shut off. Excavator clearing trench to replace sleeve.', citizenMsg: 'The water line valve was shut off and our repair crew is replacing the burst pipe section.', hoursAgo: 2, status: 'In progress' }
      ]
    },
    {
      trackingCode: 'VS-4J6P8',
      text: 'Pedestrian signal push button damaged and stuck on red near Jyothi circle.',
      lang: 'en',
      summary_en: 'Pedestrian crossing push-button stuck preventing safe crossing near Jyothi circle.',
      summary_user: 'Pedestrian crossing push-button stuck preventing safe crossing near Jyothi circle.',
      category: 'Streetlight',
      offsetLat: 0.0002,
      offsetLon: 0.0008,
      factors: {
        safetyRisk: { score: 3, reason: 'Pedestrians having to cross busy 4-lane road without signal.' },
        peopleAffected: { score: 4, reason: 'Major pedestrian crossing hub.' },
        vulnerableLocation: { score: 4, reason: 'College and cinema junction.' },
        recurrence: { score: 2, reason: 'Push button jammed inside casing.' },
        durationOrWorsening: { score: 2, reason: 'Stuck since morning.' },
      },
      status: 'Assigned',
      assignedTeam: 'Electrical',
      ageHours: 15,
      affectedCount: 6,
    },
    {
      trackingCode: 'VS-8M9R1',
      text: 'Mud and loose gravel washed down onto roadway after hill slide near Kadri hills.',
      lang: 'en',
      summary_en: 'Mud and loose gravel deposited across road from hill runoff.',
      summary_user: 'Mud and loose gravel deposited across road from hill runoff.',
      category: 'Road damage',
      offsetLat: 0.0058,
      offsetLon: 0.0045,
      factors: {
        safetyRisk: { score: 4, reason: 'Two-wheelers losing balance on slippery gravel layer.' },
        peopleAffected: { score: 3, reason: 'Hill access road.' },
        vulnerableLocation: { score: 2, reason: 'Curved hillside descent.' },
        recurrence: { score: 3, reason: 'Monsoon soil erosion.' },
        durationOrWorsening: { score: 3, reason: 'Thick layer over 20 meters.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 42,
      affectedCount: 5,
    },
    {
      trackingCode: 'VS-2D5K3',
      text: 'Broken glass and discarded bottles scattered inside children play park in Kadri.',
      lang: 'en',
      summary_en: 'Broken bottles and glass debris scattered across children play park.',
      summary_user: 'Broken bottles and glass debris scattered across children play park.',
      category: 'Garbage',
      offsetLat: 0.0040,
      offsetLon: 0.0028,
      factors: {
        safetyRisk: { score: 4, reason: 'Severe laceration danger for barefoot playing children.' },
        peopleAffected: { score: 3, reason: 'Neighborhood children and families.' },
        vulnerableLocation: { score: 5, reason: 'Designated children playground.' },
        recurrence: { score: 2, reason: 'Late night vandalism.' },
        durationOrWorsening: { score: 2, reason: 'Sharp shards in sand pit.' },
      },
      status: 'Resolved',
      assignedTeam: 'Sanitation',
      ageHours: 180,
      affectedCount: 14,
      notes: [
        { note: 'Play area sand raked twice, 4 bags of debris collected and safely disposed.', citizenMsg: 'Our team thoroughly raked the play park sand and cleared all broken glass.', hoursAgo: 100, status: 'Resolved' }
      ]
    },
    {
      trackingCode: 'VS-7F2B9',
      text: 'Water stagnant for 5 days in unpaved alleyway behind commercial street shops.',
      lang: 'en',
      summary_en: 'Stagnant foul water ponding in alleyway behind commercial shops for 5 days.',
      summary_user: 'Stagnant foul water ponding in alleyway behind commercial shops for 5 days.',
      category: 'Waterlogging',
      offsetLat: -0.0005,
      offsetLon: -0.0030,
      factors: {
        safetyRisk: { score: 2, reason: 'Breeding ground for insects and poor sanitation.' },
        peopleAffected: { score: 2, reason: 'Service alleyway workers.' },
        vulnerableLocation: { score: 2, reason: 'Commercial back alley.' },
        recurrence: { score: 3, reason: 'Depression in unpaved ground.' },
        durationOrWorsening: { score: 3, reason: 'Standing water unchanged for 5 days.' },
      },
      status: 'Under review',
      assignedTeam: null,
      ageHours: 125,
      affectedCount: 2,
    },
    {
      trackingCode: 'VS-6T8X2',
      text: 'Loose curb stones displaced by turning trucks near Ladyhill school bus bay.',
      lang: 'en',
      summary_en: 'Heavy granite curb stones dislodged into vehicle lane near school bus bay.',
      summary_user: 'Heavy granite curb stones dislodged into vehicle lane near school bus bay.',
      category: 'Road damage',
      offsetLat: 0.0065,
      offsetLon: -0.0012,
      factors: {
        safetyRisk: { score: 3, reason: 'Vehicles hitting 50kg granite curb in darkness.' },
        peopleAffected: { score: 3, reason: 'School buses and morning traffic.' },
        vulnerableLocation: { score: 4, reason: 'School bus bay.' },
        recurrence: { score: 2, reason: 'Sharp turn radius.' },
        durationOrWorsening: { score: 2, reason: 'Three blocks lying flat in road.' },
      },
      status: 'Submitted',
      assignedTeam: null,
      ageHours: 30,
      affectedCount: 4,
    }
  ];

  // Map to build final Report objects
  const reports: Report[] = [];
  const trackingToId: Record<string, string> = {};

  // First pass: assign IDs
  rawSeeds.forEach((s, idx) => {
    const id = `rep-seed-${(idx + 1).toString().padStart(3, '0')}`;
    trackingToId[s.trackingCode] = id;
  });

  rawSeeds.forEach((s, idx) => {
    const id = `rep-seed-${(idx + 1).toString().padStart(3, '0')}`;
    const createdAtTime = new Date(now - s.ageHours * 3600 * 1000).toISOString();
    
    // Compute priority
    const { score } = calculatePriorityScore(s.factors, s.duplicateOfTrackingCode ? 0 : 0);
    const band = determinePriorityBand(score, s.factors.safetyRisk.score);
    const targetDueAt = computeTargetDueDate(createdAtTime, band);

    const history: Report['statusHistory'] = [
      {
        status: 'Submitted',
        note: 'Citizen report received through VoxSetu web app.',
        citizenMessage: 'Your report was received and analyzed by our AI triage system.',
        by: 'System',
        timestamp: createdAtTime,
      }
    ];

    if (s.notes) {
      s.notes.forEach((n) => {
        history.push({
          status: n.status,
          note: n.note,
          citizenMessage: n.citizenMsg,
          by: 'Officer (Triage Desk)',
          timestamp: new Date(now - n.hoursAgo * 3600 * 1000).toISOString(),
        });
      });
    }

    const parentId = s.duplicateOfTrackingCode ? trackingToId[s.duplicateOfTrackingCode] || null : null;

    reports.push({
      id,
      trackingCode: s.trackingCode,
      citizenId: s.trackingCode,
      originalText: s.text,
      originalLanguage: s.lang,
      summary_en: s.summary_en,
      summary_user: s.summary_user,
      category: s.category,
      lat: Number((baseLat + s.offsetLat).toFixed(6)),
      lon: Number((baseLon + s.offsetLon).toFixed(6)),
      factors: s.factors,
      priorityScore: score,
      priorityBand: band,
      status: s.status,
      assignedTeam: s.assignedTeam,
      duplicateOf: parentId,
      duplicateConfidence: s.duplicateConfidence || null,
      duplicateReason: s.duplicateReason || null,
      linkedCount: 0,
      affectedCount: s.affectedCount || 0,
      targetDueAt,
      statusHistory: history,
      resolutionNote: s.status === 'Resolved' ? 'Repaired and verified in field.' : null,
      citizenConfirmed: s.status === 'Resolved',
      reopenCount: s.status === 'Reopened' ? 1 : 0,
      suspectedSpam: false,
      isSample: true,
      createdAt: createdAtTime,
    });
  });

  // Second pass: compute linkedCount for parents
  reports.forEach((rep) => {
    if (rep.duplicateOf) {
      const parent = reports.find((r) => r.id === rep.duplicateOf);
      if (parent) {
        parent.linkedCount = (parent.linkedCount || 0) + 1;
        // Re-score parent with duplicate recurrence boost
        const { score: newScore } = calculatePriorityScore(parent.factors, parent.linkedCount);
        parent.priorityScore = newScore;
        parent.priorityBand = determinePriorityBand(newScore, parent.factors.safetyRisk.score);
      }
    }
  });

  return reports;
}
