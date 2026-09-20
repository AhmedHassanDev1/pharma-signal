import { z } from 'zod';
import { DetectionStatus } from '@pharma-signal/contracts';

export const detectionStatusSchema = z.nativeEnum(DetectionStatus);
