import type { WorkspaceDoc } from '../models.js';

export function workspaceView(
  workspace: Pick<
    WorkspaceDoc,
    | '_id'
    | 'businessName'
    | 'category'
    | 'timezone'
    | 'currency'
    | 'defaultCountryCode'
    | 'bookingLink'
    | 'followUpDays'
    | 'onboardingComplete'
    | 'reviewResponseTemplate'
    | 'isDemo'
  >,
) {
  return {
    id: String(workspace._id),
    businessName: workspace.businessName,
    category: workspace.category ?? null,
    timezone: workspace.timezone,
    currency: workspace.currency,
    defaultCountryCode: workspace.defaultCountryCode,
    bookingLink: workspace.bookingLink || null,
    followUpDays: workspace.followUpDays,
    onboardingComplete: workspace.onboardingComplete,
    reviewResponseTemplate: workspace.reviewResponseTemplate ?? '',
    isDemo: workspace.isDemo,
  };
}
