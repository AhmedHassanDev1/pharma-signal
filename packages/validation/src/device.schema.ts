import { z } from 'zod';
import { DeviceStatus } from '@pharma-signal/contracts';

export const deviceStatusSchema = z.nativeEnum(DeviceStatus);

export const enrollDeviceSchema = z.object({
  enrollmentToken: z.string().min(1, 'enrollmentToken is required'),
  agentInstanceId: z.string().min(1, 'agentInstanceId is required'),
  hostname: z.string().min(1, 'hostname is required'),
  os: z.string().min(1, 'os is required'),
  appVersion: z.string().min(1, 'appVersion is required')
});

export type EnrollDeviceInput = z.infer<typeof enrollDeviceSchema>;
