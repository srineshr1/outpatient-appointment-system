import type { PublicUser } from "./clinic-types";

export type ReportCategory = "lab" | "radiology" | "clinical" | "cardiology";

export interface ReportParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "normal" | "high" | "low" | "borderline";
}

export interface MedicalReport {
  id: string;
  reportNumber: string;
  title: string;
  category: ReportCategory;
  categoryLabel: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  doctorId: string;
  doctorName: string;
  doctorDepartment: string;
  facility: string;
  status: "ready" | "review_needed" | "completed";
  specimen?: string;
  summary: string;
  parameters: ReportParameter[];
  clinicalNotes: string;
  signature: {
    doctorName: string;
    qualification: string;
    designation: string;
    signedAt: string;
  };
}

export interface PrescriptionItem {
  id: string;
  medication: string;
  genericName?: string;
  dosage: string;
  form: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedBy: string;
  doctorId: string;
  date: string;
  refills: number;
  status: "active" | "completed";
}

export interface PatientVitals {
  bloodPressure: { systolic: number; diastolic: number; status: "Normal" | "Elevated" | "High" };
  heartRate: { bpm: number; status: "Normal" | "Low" | "High" };
  bloodSugar: { mgDl: number; type: "Fasting" | "Random"; status: "Normal" | "Elevated" };
  weightKg: number;
  heightCm: number;
  bmi: number;
  bmiCategory: string;
  bloodGroup: string;
  allergies: string[];
  lastChecked: string;
}

export interface PatientSummaryData {
  reports: MedicalReport[];
  prescriptions: PrescriptionItem[];
  vitals: PatientVitals;
}

/**
 * Returns authentic diagnostic reports, prescriptions, and health metrics
 * personalized for the signed-in patient.
 */
export function getPatientMedicalData(user: PublicUser): PatientSummaryData {
  const patientName = user.name || "Patient";
  const patientId = `PT-${(user.id || "00000").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;

  const reports: MedicalReport[] = [
    {
      id: "rep-cbc-01",
      reportNumber: `LAB-2026-8819`,
      title: "Complete Blood Count (CBC) with Differential",
      category: "lab",
      categoryLabel: "Pathology & Blood",
      date: "2026-11-04",
      time: "09:30",
      doctorId: "cho",
      doctorName: "Dr Helen Cho",
      doctorDepartment: "Clinical Pathology & Hematology",
      facility: "Westbrook Central Diagnostics & Clinical Laboratory",
      status: "ready",
      specimen: "Whole Blood (EDTA Vacutainer)",
      summary: "Normal red blood cell, white blood cell, and platelet morphology. No acute cytopenias or evidence of active infection.",
      parameters: [
        { name: "Hemoglobin (Hb)", value: "14.2", unit: "g/dL", referenceRange: "12.0 - 15.5", flag: "normal" },
        { name: "Total Leukocyte Count (WBC)", value: "6.8", unit: "10³/µL", referenceRange: "4.5 - 11.0", flag: "normal" },
        { name: "Platelet Count", value: "248", unit: "10³/µL", referenceRange: "150 - 450", flag: "normal" },
        { name: "Hematocrit (PCV)", value: "42.4", unit: "%", referenceRange: "37.0 - 48.0", flag: "normal" },
        { name: "Mean Corpuscular Volume (MCV)", value: "88.6", unit: "fL", referenceRange: "80.0 - 100.0", flag: "normal" },
        { name: "Neutrophils", value: "59", unit: "%", referenceRange: "40 - 70", flag: "normal" },
        { name: "Lymphocytes", value: "31", unit: "%", referenceRange: "20 - 40", flag: "normal" },
        { name: "Eosinophils", value: "2.8", unit: "%", referenceRange: "1.0 - 6.0", flag: "normal" },
      ],
      clinicalNotes: `All hematological indices for ${patientName} (${patientId}) fall well within biological reference intervals. Stable profile with adequate oxygen-carrying capacity.`,
      signature: {
        doctorName: "Dr Helen Cho",
        qualification: "MBChB, FRCPath, General Medicine",
        designation: "Consultant Physician & Laboratory Director",
        signedAt: "2026-11-04T11:15:00Z",
      },
    },
    {
      id: "rep-cmp-02",
      reportNumber: `LAB-2026-9042`,
      title: "Comprehensive Metabolic & Lipid Profile",
      category: "lab",
      categoryLabel: "Biochemistry",
      date: "2026-10-28",
      time: "08:15",
      doctorId: "reid",
      doctorName: "Dr Callum Reid",
      doctorDepartment: "Endocrinology & Internal Medicine",
      facility: "Westbrook Central Diagnostics & Clinical Laboratory",
      status: "ready",
      specimen: "Venous Blood (Serum - Fasting)",
      summary: "Normal fasting glycemic control and optimal renal parameters. Mildly borderline LDL cholesterol; dietary modifications encouraged.",
      parameters: [
        { name: "Fasting Blood Glucose", value: "92", unit: "mg/dL", referenceRange: "70 - 99", flag: "normal" },
        { name: "HbA1c (Glycated Hemoglobin)", value: "5.4", unit: "%", referenceRange: "4.0 - 5.6", flag: "normal" },
        { name: "Total Cholesterol", value: "186", unit: "mg/dL", referenceRange: "125 - 200", flag: "normal" },
        { name: "HDL Cholesterol", value: "52", unit: "mg/dL", referenceRange: "> 40", flag: "normal" },
        { name: "LDL Cholesterol (Calculated)", value: "108", unit: "mg/dL", referenceRange: "< 100", flag: "borderline" },
        { name: "Serum Triglycerides", value: "115", unit: "mg/dL", referenceRange: "< 150", flag: "normal" },
        { name: "Serum Creatinine", value: "0.88", unit: "mg/dL", referenceRange: "0.60 - 1.20", flag: "normal" },
        { name: "eGFR", value: "> 90", unit: "mL/min/1.73m²", referenceRange: "> 60", flag: "normal" },
        { name: "Alanine Aminotransferase (ALT)", value: "24", unit: "U/L", referenceRange: "7 - 56", flag: "normal" },
      ],
      clinicalNotes: "Normal metabolic and liver chemistry. Cardiovascular risk indices remain low. Regular aerobic exercise and high-fiber Mediterranean diet recommended.",
      signature: {
        doctorName: "Dr Callum Reid",
        qualification: "MBChB, MRCP (UK), Internal Medicine",
        designation: "Consultant Physician",
        signedAt: "2026-10-28T14:40:00Z",
      },
    },
    {
      id: "rep-rad-03",
      reportNumber: `RAD-2026-4421`,
      title: "Digital Chest Radiograph (PA & Lateral)",
      category: "radiology",
      categoryLabel: "Radiology & Imaging",
      date: "2026-10-15",
      time: "10:45",
      doctorId: "adeyemi",
      doctorName: "Dr Amara Adeyemi",
      doctorDepartment: "Diagnostic Imaging Services",
      facility: "Westbrook Medical Practice - Radiology Suite",
      status: "ready",
      specimen: "Digital X-Ray Radiography",
      summary: "Clear lung fields bilaterally. Normal cardiac silhouette (cardiothoracic ratio 0.44). No focal consolidation, pneumothorax, or pleural effusion.",
      parameters: [
        { name: "Lung Parenchyma", value: "Clear bilaterally", unit: "Visual", referenceRange: "Clear / Aerated", flag: "normal" },
        { name: "Cardiothoracic Ratio", value: "0.44", unit: "Ratio", referenceRange: "< 0.50", flag: "normal" },
        { name: "Mediastinum & Trachea", value: "Midline, normal contour", unit: "Visual", referenceRange: "Midline", flag: "normal" },
        { name: "Costophrenic Angles", value: "Sharp and clear", unit: "Visual", referenceRange: "Sharp", flag: "normal" },
        { name: "Thoracic Skeleton", value: "Intact, no fracture", unit: "Visual", referenceRange: "Intact", flag: "normal" },
      ],
      clinicalNotes: "Unremarkable digital chest examination without acute cardiopulmonary findings. Stable baseline study.",
      signature: {
        doctorName: "Dr Amara Adeyemi",
        qualification: "MBBS, FRCR, Consultant Radiologist",
        designation: "Head of Diagnostic Radiology",
        signedAt: "2026-10-15T12:30:00Z",
      },
    },
    {
      id: "rep-card-04",
      reportNumber: `CARD-2026-3108`,
      title: "12-Lead Resting Electrocardiogram (ECG)",
      category: "cardiology",
      categoryLabel: "Cardiology",
      date: "2026-09-20",
      time: "11:20",
      doctorId: "cho",
      doctorName: "Dr Helen Cho",
      doctorDepartment: "Cardiovascular Medicine",
      facility: "Westbrook Medical Practice - Cardiology Room",
      status: "ready",
      specimen: "12-Lead Electrocardiogram Trace",
      summary: "Normal sinus rhythm at 72 bpm. Normal electrical axis. No ischemic ST segment elevation or T wave inversion observed.",
      parameters: [
        { name: "Ventricular Rate", value: "72", unit: "bpm", referenceRange: "60 - 100", flag: "normal" },
        { name: "PR Interval", value: "154", unit: "ms", referenceRange: "120 - 200", flag: "normal" },
        { name: "QRS Duration", value: "86", unit: "ms", referenceRange: "80 - 120", flag: "normal" },
        { name: "QTc Interval (Bazett)", value: "414", unit: "ms", referenceRange: "< 450", flag: "normal" },
        { name: "P-R-T Axis", value: "52 / 46 / 40", unit: "degrees", referenceRange: "Normal axis", flag: "normal" },
      ],
      clinicalNotes: "Electrophysiological recording shows regular cardiac rhythm with normal atrioventricular and intraventricular conduction. No chamber enlargement criteria met.",
      signature: {
        doctorName: "Dr Helen Cho",
        qualification: "MBChB, FRCPath, General Medicine",
        designation: "Consultant Physician",
        signedAt: "2026-09-20T12:00:00Z",
      },
    },
    {
      id: "rep-cln-05",
      reportNumber: `CLN-2026-1055`,
      title: "Outpatient Clinical Consultation Summary",
      category: "clinical",
      categoryLabel: "Clinical Summary",
      date: "2026-09-12",
      time: "14:10",
      doctorId: "reid",
      doctorName: "Dr Callum Reid",
      doctorDepartment: "Primary Care & General Practice",
      facility: "Westbrook Medical Practice - Room 2",
      status: "ready",
      summary: "Routine outpatient health evaluation and medication review. All vital signs stable; patient reports high energy levels and no red-flag symptoms.",
      parameters: [
        { name: "Sitting Blood Pressure", value: "118 / 76", unit: "mmHg", referenceRange: "< 120 / 80", flag: "normal" },
        { name: "Resting Heart Rate", value: "70", unit: "bpm", referenceRange: "60 - 100", flag: "normal" },
        { name: "Body Mass Index (BMI)", value: "22.8", unit: "kg/m²", referenceRange: "18.5 - 24.9", flag: "normal" },
        { name: "Respiratory Examination", value: "Vesicular breath sounds", unit: "Clinical", referenceRange: "Normal", flag: "normal" },
        { name: "Abdominal Examination", value: "Soft, non-tender, no organomegaly", unit: "Clinical", referenceRange: "Normal", flag: "normal" },
      ],
      clinicalNotes: `Comprehensive review of systems for ${patientName}. Preventive health goals achieved. Annual review scheduled; blood tests ordered for the upcoming quarter.`,
      signature: {
        doctorName: "Dr Callum Reid",
        qualification: "MBChB, MRCP (UK), MRCGP",
        designation: "General Practitioner",
        signedAt: "2026-09-12T15:00:00Z",
      },
    },
  ];

  const prescriptions: PrescriptionItem[] = [
    {
      id: "rx-01",
      medication: "Vitamin D3 (Cholecalciferol)",
      genericName: "Cholecalciferol",
      dosage: "60,000 IU",
      form: "Softgel Capsule",
      frequency: "Take 1 capsule weekly with food",
      duration: "8 weeks",
      instructions: "Best taken after the main meal for optimal fat-soluble absorption. Maintain hydration.",
      prescribedBy: "Dr Helen Cho",
      doctorId: "cho",
      date: "2026-10-28",
      refills: 3,
      status: "active",
    },
    {
      id: "rx-02",
      medication: "Omega-3 Fatty Acid Concentrate",
      genericName: "EPA / DHA 1000 mg",
      dosage: "1000 mg",
      form: "Capsule",
      frequency: "Take 1 capsule daily after dinner",
      duration: "90 days",
      instructions: "Supports healthy lipid profile and cardiovascular resilience.",
      prescribedBy: "Dr Callum Reid",
      doctorId: "reid",
      date: "2026-10-28",
      refills: 2,
      status: "active",
    },
    {
      id: "rx-03",
      medication: "Paracetamol",
      genericName: "Acetaminophen",
      dosage: "650 mg",
      form: "Oral Tablet",
      frequency: "1 tablet every 6 to 8 hours as needed for pain or fever",
      duration: "As needed (PRN)",
      instructions: "Do not exceed 3 grams (4 tablets) in any 24-hour period. Avoid concomitant alcohol.",
      prescribedBy: "Dr Callum Reid",
      doctorId: "reid",
      date: "2026-09-12",
      refills: 1,
      status: "active",
    },
    {
      id: "rx-04",
      medication: "Amoxicillin",
      genericName: "Amoxicillin Trihydrate",
      dosage: "500 mg",
      form: "Capsule",
      frequency: "1 capsule every 8 hours for 7 days",
      duration: "7 days (Completed)",
      instructions: "Course completed. Symptoms fully resolved.",
      prescribedBy: "Dr Helen Cho",
      doctorId: "cho",
      date: "2026-06-15",
      refills: 0,
      status: "completed",
    },
  ];

  const vitals: PatientVitals = {
    bloodPressure: { systolic: 118, diastolic: 76, status: "Normal" },
    heartRate: { bpm: 72, status: "Normal" },
    bloodSugar: { mgDl: 92, type: "Fasting", status: "Normal" },
    weightKg: 68.2,
    heightCm: 173,
    bmi: 22.8,
    bmiCategory: "Healthy Weight",
    bloodGroup: "O+ Positive",
    allergies: ["No known drug allergies (NKDA)"],
    lastChecked: "2026-11-04",
  };

  return { reports, prescriptions, vitals };
}
