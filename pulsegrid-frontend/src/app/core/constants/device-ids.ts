// Single source for the known device fleet — previously hardcoded separately
// in dashboard-layout.service.ts and duplicated (with looser regex validation)
// in device-exists.guard.ts.
export const DEVICE_IDS = ['device1', 'device2', 'device3', 'device4', 'device5'] as const;
