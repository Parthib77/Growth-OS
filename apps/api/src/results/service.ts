import { addLocalDays, resultsBounds } from '../timezone.js';
import { Booking, OperationalEvent, Workspace } from '../models.js';
import { AppError } from '../errors.js';
import { safeCsvCell } from '../customers/domain.js';

export async function readResults(input: {
  workspaceId: string;
  from?: string;
  through?: string;
  to?: string;
}) {
  const workspace = await Workspace.findById(input.workspaceId).lean();
  if (!workspace) throw new AppError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
  const bounds = resultsBounds(
    { from: input.from, through: input.through, to: input.to },
    workspace.timezone,
  );
  const includedBookingStatuses = ['tentative', 'confirmed', 'completed', 'no_show'] as const;
  const throughLocal = input.through ?? addLocalDays(bounds.toLocal, -1);
  const eventFilter = {
    workspaceId: input.workspaceId,
    occurredAt: { $gte: bounds.from, $lt: bounds.to },
  };
  const [
    newEnquiries,
    bookings,
    followUpsPrepared,
    followUpsSent,
    campaignReplies,
    campaignConversions,
  ] = await Promise.all([
    OperationalEvent.countDocuments({ ...eventFilter, type: 'enquiry.created' }),
    Booking.find({
      workspaceId: input.workspaceId,
      createdAt: { $gte: bounds.from, $lt: bounds.to },
      state: { $in: includedBookingStatuses },
    }).lean(),
    OperationalEvent.countDocuments({ ...eventFilter, type: 'campaign.message_prepared' }),
    OperationalEvent.countDocuments({ ...eventFilter, type: 'campaign.message_sent' }),
    OperationalEvent.countDocuments({ ...eventFilter, type: 'campaign.reply_recorded' }),
    Booking.countDocuments({
      workspaceId: input.workspaceId,
      createdAt: { $gte: bounds.from, $lt: bounds.to },
      sourceCampaignRecipientId: { $exists: true, $ne: null },
      state: { $in: includedBookingStatuses },
    }),
  ]);
  return {
    range: {
      from: bounds.from.toISOString(),
      to: bounds.to.toISOString(),
      fromLocal: bounds.fromLocal,
      toLocal: bounds.toLocal,
      throughLocal,
      timezone: workspace.timezone,
    },
    throughLocal,
    generatedAt: new Date().toISOString(),
    includedBookingStatuses,
    newEnquiries,
    bookingsRecorded: bookings.length,
    bookingDefinition:
      'Bookings created in this workspace-local range; includes tentative, confirmed, completed, and no-show records.',
    recordedValueDefinition:
      'Sum of agreed booking value for those records, not collected revenue.',
    recordedBookingValue: {
      currency: workspace.currency,
      minorUnits: bookings.reduce((sum, item) => sum + item.agreedMinorUnits, 0),
    },
    followUpsPrepared,
    followUpsSent,
    campaignReplies,
    campaignConversions,
  };
}

export function resultsCsv(result: Awaited<ReturnType<typeof readResults>>): string {
  const rows: [string, string | number][] = [
    ['from_local', result.range.fromLocal],
    ['through_local', result.throughLocal],
    ['timezone', result.range.timezone],
    ['new_enquiries', result.newEnquiries],
    ['bookings_recorded', result.bookingsRecorded],
    ['recorded_booking_value_minor_units', result.recordedBookingValue.minorUnits],
    ['recorded_booking_currency', result.recordedBookingValue.currency],
    ['follow_ups_prepared', result.followUpsPrepared],
    ['follow_ups_sent', result.followUpsSent],
    ['campaign_replies', result.campaignReplies],
    ['campaign_conversions', result.campaignConversions],
  ];
  return [
    'metric,value',
    ...rows.map(([metric, value]) => `${safeCsvCell(metric)},${safeCsvCell(String(value))}`),
  ].join('\n');
}
