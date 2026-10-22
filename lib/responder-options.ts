export const RESPONDER_TYPES = [
  { code: "municipal_office", label: "Municipal office" },
  { code: "rescue_unit", label: "Rescue unit" },
  { code: "emergency_service", label: "Emergency service" },
  { code: "ngo", label: "Nonprofit organization" },
  { code: "volunteer_group", label: "Volunteer group" },
] as const;

export const RESPONDER_CAPABILITIES = [
  { code: "flood_rescue", label: "Flood rescue" },
  { code: "water_rescue", label: "Water rescue" },
  { code: "boat", label: "Boat rescue" },
  { code: "evacuation", label: "Evacuation" },
  { code: "medical", label: "Medical assistance" },
  { code: "transportation", label: "Transportation" },
  { code: "general_response", label: "General emergency response" },
] as const;

export function responderCapabilityLabel(code: string) {
  return RESPONDER_CAPABILITIES.find((option) => option.code === code)?.label ?? code.replaceAll("_", " ");
}
