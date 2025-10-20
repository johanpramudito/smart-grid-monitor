import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '../../../lib/database/connection';
import { runFlisrWorkflow } from '../../../lib/flisr/service';

// Zod schema for input validation. We trigger the process with a specific fault event ID.
const flisrTriggerSchema = z.object({
  faultEventId: z.number().int().positive(),
});

/**
 * POST /api/flisr
 * Triggers the Fault Location, Isolation, and Service Restoration (FLISR) process.
 * This is triggered after a fault has been detected and logged in the EventLog.
 */
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const validation = flisrTriggerSchema.safeParse(body);
    if (!validation.success) {
      const errorDetails = validation.error.flatten();
      return NextResponse.json(
        { message: errorDetails.formErrors[0] ?? 'Invalid input.', errors: errorDetails },
        { status: 400 },
      );
    }

    const { faultEventId } = validation.data;
    const workflowResult = await runFlisrWorkflow(client, faultEventId);

    return NextResponse.json({
      message: 'FLISR process completed successfully.',
      faultAnalysis: {
        faultEventId,
        faultConnectionId: workflowResult.faultContext.gridConnectionId,
        fromZone: workflowResult.faultContext.fromZoneName ?? workflowResult.faultContext.fromZoneId,
        toZone: workflowResult.faultContext.toZoneName ?? workflowResult.faultContext.toZoneId,
        propagationSpeed: `${workflowResult.distanceResult.propagationSpeed.toFixed(0)} m/s`,
        timeDeltaSeconds: Number(workflowResult.distanceResult.timeDeltaSeconds.toFixed(9)),
        distanceFromSourceMeters: Number(workflowResult.distanceResult.distanceFromStartMeters.toFixed(2)),
        distanceFromLoadMeters: Number(workflowResult.distanceResult.distanceFromEndMeters.toFixed(2)),
        confidence: workflowResult.distanceResult.confidence,
        clamped: workflowResult.distanceResult.clamped,
      },
      serviceRestoration: workflowResult.restorationPlan,
    });
  } catch (error) {
    console.error('Error during FLISR process:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const status =
      error instanceof Error && error.name === 'NotFoundError'
        ? 404
        : 500;
    return NextResponse.json({ message: 'FLISR execution failed', error: errorMessage }, { status });
  } finally {
    client.release();
  }
}
