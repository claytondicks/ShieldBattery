import { SbPolicyType } from './policies/policy-type'
import { SbUserId } from './users/sb-user'

export enum NotificationType {
  EmailVerification = 'emailVerification',
  PartyInvite = 'partyInvite',
  PolicyUpdated = 'policyUpdated',
}

export interface BaseNotification {
  /**
   * A string that is unique if the notification is unique. For locally-generated notifications
   * that should never show duplicates, this might be a constant string. For server-generated ones
   * that have multiple of the same type (e.g. chat notifications, party invites, etc.) these are
   * generated by the server.
   */
  readonly id: string
  /** The notification type. */
  readonly type: NotificationType
  /** A flag indicating whether the notification has been marked as read. */
  readonly read: boolean
  /** A timestamp indicating the time a notification has been created. */
  readonly createdAt: number
  /** A flag indicating whether the notification is generated locally or on the server. */
  readonly local?: boolean
}

export interface EmailVerificationNotification extends BaseNotification {
  type: typeof NotificationType.EmailVerification
  local: true
}

export const EMAIL_VERIFICATION_ID = 'local-emailVerification'

export interface PolicyUpdatedNotification extends BaseNotification {
  type: typeof NotificationType.PolicyUpdated
  local: true
  policyType: SbPolicyType
}

export interface PartyInviteNotification extends BaseNotification {
  type: typeof NotificationType.PartyInvite
  from: SbUserId
  partyId: string
}

export type SbNotification =
  | EmailVerificationNotification
  | PartyInviteNotification
  | PolicyUpdatedNotification

export interface NotificationServerInitEvent {
  type: 'serverInit'
  notifications: SbNotification[]
}

export interface NotificationAddEvent {
  type: 'add'
  notification: SbNotification
}

export interface NotificationClearByIdEvent {
  type: 'clearById'
  notificationId: string
}

export interface NotificationClearEvent {
  type: 'clear'
  timestamp: number
}

export interface NotificationMarkReadEvent {
  type: 'markRead'
  notificationIds: ReadonlyArray<string>
}

export type NotificationEvent =
  | NotificationServerInitEvent
  | NotificationAddEvent
  | NotificationClearEvent
  | NotificationClearByIdEvent
  | NotificationMarkReadEvent

export interface ClearNotificationsServerRequest {
  timestamp: number | undefined
}

export interface ClearNotificationsServerResponse {
  timestamp: number
}

export interface MarkNotificationsReadServerRequest {
  notificationIds: ReadonlyArray<string>
}
