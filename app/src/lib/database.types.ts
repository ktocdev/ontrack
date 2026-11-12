
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"meta": NonNullable<Json>,"target_restaurant_id": string | null,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"target_restaurant_id"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"meta"?: NonNullable<Json>,"target_restaurant_id"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "audit_log_target_restaurant_id_fkey"
      columns: ["target_restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_target_restaurant_id_fkey"
      columns: ["target_restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "audit_log_target_restaurant_id_fkey"
      columns: ["target_restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "audit_log_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"area": Database["public"]['Enums']["area"],"id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"area": Database["public"]['Enums']["area"],"id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"area"?: Database["public"]['Enums']["area"],"id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"contractors": {
                  Row: {
                    "archived_at": string | null,"contact_name": string | null,"created_at": string,"created_by": string | null,"email": string | null,"id": string,"insurance_until": string | null,"name": string,"notes": string | null,"phone": string | null,"preferred": boolean,"trade": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"insurance_until"?: string | null,"name": string,"notes"?: string | null,"phone"?: string | null,"preferred"?: boolean,"trade": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"contact_name"?: string | null,"created_at"?: string,"created_by"?: string | null,"email"?: string | null,"id"?: string,"insurance_until"?: string | null,"name"?: string,"notes"?: string | null,"phone"?: string | null,"preferred"?: boolean,"trade"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contractors_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contractors_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"equipment": {
                  Row: {
                    "brand": string | null,"category_id": string,"created_at": string,"created_by": string | null,"id": string,"installed_on": string | null,"location_note": string | null,"manual_path": string | null,"model": string | null,"name": string,"plate_photo_path": string | null,"restaurant_id": string,"retired_at": string | null,"retired_by": string | null,"serial": string | null,"updated_at": string,"warranty_note": string | null,"warranty_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"category_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"installed_on"?: string | null,"location_note"?: string | null,"manual_path"?: string | null,"model"?: string | null,"name": string,"plate_photo_path"?: string | null,"restaurant_id": string,"retired_at"?: string | null,"retired_by"?: string | null,"serial"?: string | null,"updated_at"?: string,"warranty_note"?: string | null,"warranty_until"?: string | null
                  }
                  Update: {
                    "brand"?: string | null,"category_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"installed_on"?: string | null,"location_note"?: string | null,"manual_path"?: string | null,"model"?: string | null,"name"?: string,"plate_photo_path"?: string | null,"restaurant_id"?: string,"retired_at"?: string | null,"retired_by"?: string | null,"serial"?: string | null,"updated_at"?: string,"warranty_note"?: string | null,"warranty_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipment_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "v_category_history"
      referencedColumns: ["category_id"]
    },{
      foreignKeyName: "equipment_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "equipment_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "equipment_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "equipment_retired_by_fkey"
      columns: ["retired_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_retired_by_fkey"
      columns: ["retired_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"group_settings": {
                  Row: {
                    "id": boolean,"name": string,"profile_photos": boolean,"short_name": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: boolean,"name"?: string,"profile_photos"?: boolean,"short_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "id"?: boolean,"name"?: string,"profile_photos"?: boolean,"short_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inhouse_fixes": {
                  Row: {
                    "area": Database["public"]['Enums']["area"] | null,"check_id": string | null,"converted_ticket_id": string | null,"created_at": string,"created_by": string | null,"done_at": string | null,"done_by": string | null,"first_done_at": string | null,"id": string,"note": string | null,"origin_label": string | null,"restaurant_id": string,"title": string,"walkthrough_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: Database["public"]['Enums']["area"] | null,"check_id"?: string | null,"converted_ticket_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"first_done_at"?: string | null,"id"?: string,"note"?: string | null,"origin_label"?: string | null,"restaurant_id": string,"title": string,"walkthrough_id"?: string | null
                  }
                  Update: {
                    "area"?: Database["public"]['Enums']["area"] | null,"check_id"?: string | null,"converted_ticket_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"done_at"?: string | null,"done_by"?: string | null,"first_done_at"?: string | null,"id"?: string,"note"?: string | null,"origin_label"?: string | null,"restaurant_id"?: string,"title"?: string,"walkthrough_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inhouse_fixes_check_id_fkey"
      columns: ["check_id"]
isOneToOne: false
      referencedRelation: "walkthrough_checks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inhouse_fixes_converted_ticket_id_fkey"
      columns: ["converted_ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inhouse_fixes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inhouse_fixes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "inhouse_fixes_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inhouse_fixes_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "inhouse_fixes_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inhouse_fixes_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "inhouse_fixes_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "inhouse_fixes_walkthrough_id_fkey"
      columns: ["walkthrough_id"]
isOneToOne: false
      referencedRelation: "walkthroughs"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"full_name": string,"id": string,"invited_by": string | null,"renewal_requested_at": string | null,"restaurant_ids": (string)[],"revoked_at": string | null,"role": Database["public"]['Enums']["app_role"],"sent_at": string,"status": Database["public"]['Enums']["invite_status"],"token_hash": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"full_name": string,"id"?: string,"invited_by"?: string | null,"renewal_requested_at"?: string | null,"restaurant_ids"?: (string)[],"revoked_at"?: string | null,"role": Database["public"]['Enums']["app_role"],"sent_at"?: string,"status"?: Database["public"]['Enums']["invite_status"],"token_hash": string,"user_id"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"full_name"?: string,"id"?: string,"invited_by"?: string | null,"renewal_requested_at"?: string | null,"restaurant_ids"?: (string)[],"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"sent_at"?: string,"status"?: Database["public"]['Enums']["invite_status"],"token_hash"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount_cents": number | null,"attached_at": string | null,"attached_by": string | null,"created_at": string,"id": string,"number": string | null,"path": string | null,"service_record_id": string,"status": Database["public"]['Enums']["invoice_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents"?: number | null,"attached_at"?: string | null,"attached_by"?: string | null,"created_at"?: string,"id"?: string,"number"?: string | null,"path"?: string | null,"service_record_id": string,"status"?: Database["public"]['Enums']["invoice_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number | null,"attached_at"?: string | null,"attached_by"?: string | null,"created_at"?: string,"id"?: string,"number"?: string | null,"path"?: string | null,"service_record_id"?: string,"status"?: Database["public"]['Enums']["invoice_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_attached_by_fkey"
      columns: ["attached_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_attached_by_fkey"
      columns: ["attached_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "invoices_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: true
      referencedRelation: "service_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: true
      referencedRelation: "v_missing_invoices"
      referencedColumns: ["service_record_id"]
    },{
      foreignKeyName: "invoices_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: true
      referencedRelation: "v_service_record_totals"
      referencedColumns: ["service_record_id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"restaurant_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"restaurant_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"restaurant_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "memberships_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"notification_deliveries": {
                  Row: {
                    "channel": string,"created_at": string,"id": string,"kind": string,"notification_id": string,"status": string,"ticket_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"created_at"?: string,"id"?: string,"kind": string,"notification_id": string,"status": string,"ticket_id": string,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"notification_id"?: string,"status"?: string,"ticket_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "enabled": boolean,"kind": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled": boolean,"kind": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "enabled"?: boolean,"kind"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_prefs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"body": string | null,"created_at": string,"id": string,"internal": boolean,"kind": string,"picked_up": boolean,"processed_at": string | null,"seq": number,"status_to": string | null,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"internal"?: boolean,"kind": string,"picked_up"?: boolean,"processed_at"?: string | null,"seq"?: never,"status_to"?: string | null,"ticket_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"internal"?: boolean,"kind"?: string,"picked_up"?: boolean,"processed_at"?: string | null,"seq"?: never,"status_to"?: string | null,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "notifications_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"notify_problems": {
                  Row: {
                    "first_at": string,"last_at": string,"message": string,"times": number
                  }
                  ComputedFields: never
                  Insert: {
                    "first_at"?: string,"last_at"?: string,"message": string,"times"?: number
                  }
                  Update: {
                    "first_at"?: string,"last_at"?: string,"message"?: string,"times"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"deactivated_at": string | null,"email": string,"full_name": string,"home_restaurant_id": string | null,"id": string,"phone": string | null,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email": string,"full_name": string,"home_restaurant_id"?: string | null,"id": string,"phone"?: string | null,"role": Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email"?: string,"full_name"?: string,"home_restaurant_id"?: string | null,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_home_restaurant_id_fkey"
      columns: ["home_restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_home_restaurant_id_fkey"
      columns: ["home_restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "profiles_home_restaurant_id_fkey"
      columns: ["home_restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_seen_at": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_seen_at"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_seen_at"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"quarterly_tasks": {
                  Row: {
                    "active": boolean,"created_at": string,"directions": string | null,"id": string,"months": (number)[],"overrides_task_id": string | null,"removed": boolean,"restaurant_id": string | null,"sort_order": number,"title": string,"updated_at": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"directions"?: string | null,"id"?: string,"months"?: (number)[],"overrides_task_id"?: string | null,"removed"?: boolean,"restaurant_id"?: string | null,"sort_order"?: number,"title": string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"directions"?: string | null,"id"?: string,"months"?: (number)[],"overrides_task_id"?: string | null,"removed"?: boolean,"restaurant_id"?: string | null,"sort_order"?: number,"title"?: string,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quarterly_tasks_overrides_task_id_fkey"
      columns: ["overrides_task_id"]
isOneToOne: false
      referencedRelation: "quarterly_tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quarterly_tasks_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quarterly_tasks_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "quarterly_tasks_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    }
                  ]
                },"restaurants": {
                  Row: {
                    "address": string | null,"archived_at": string | null,"archived_by": string | null,"color": string,"created_at": string,"id": string,"manager_id": string | null,"name": string,"phone": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"archived_at"?: string | null,"archived_by"?: string | null,"color": string,"created_at"?: string,"id"?: string,"manager_id"?: string | null,"name": string,"phone"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"archived_at"?: string | null,"archived_by"?: string | null,"color"?: string,"created_at"?: string,"id"?: string,"manager_id"?: string | null,"name"?: string,"phone"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restaurants_archived_by_fkey"
      columns: ["archived_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restaurants_archived_by_fkey"
      columns: ["archived_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "restaurants_manager_fk"
      columns: ["manager_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restaurants_manager_fk"
      columns: ["manager_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"rights": {
                  Row: {
                    "allowed": boolean,"id": string,"key": string,"role": Database["public"]['Enums']["app_role"] | null,"updated_at": string,"updated_by": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed": boolean,"id"?: string,"key": string,"role"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "allowed"?: boolean,"id"?: string,"key"?: string,"role"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rights_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rights_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "rights_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rights_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"service_line_items": {
                  Row: {
                    "amount_cents": number,"description": string | null,"id": string,"kind": Database["public"]['Enums']["line_item_kind"],"service_record_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"description"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["line_item_kind"],"service_record_id": string,"sort_order"?: number
                  }
                  Update: {
                    "amount_cents"?: number,"description"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["line_item_kind"],"service_record_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_line_items_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: false
      referencedRelation: "service_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_line_items_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: false
      referencedRelation: "v_missing_invoices"
      referencedColumns: ["service_record_id"]
    },{
      foreignKeyName: "service_line_items_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: false
      referencedRelation: "v_service_record_totals"
      referencedColumns: ["service_record_id"]
    }
                  ]
                },"service_records": {
                  Row: {
                    "contractor_id": string | null,"created_at": string,"equipment_id": string | null,"id": string,"kind": Database["public"]['Enums']["service_kind"],"logged_by": string | null,"notes": string | null,"restaurant_id": string,"service_date": string,"technician": string | null,"ticket_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contractor_id"?: string | null,"created_at"?: string,"equipment_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["service_kind"],"logged_by"?: string | null,"notes"?: string | null,"restaurant_id": string,"service_date"?: string,"technician"?: string | null,"ticket_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "contractor_id"?: string | null,"created_at"?: string,"equipment_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["service_kind"],"logged_by"?: string | null,"notes"?: string | null,"restaurant_id"?: string,"service_date"?: string,"technician"?: string | null,"ticket_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_records_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "v_equipment_history"
      referencedColumns: ["equipment_id"]
    },{
      foreignKeyName: "service_records_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "service_records_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"support_reports": {
                  Row: {
                    "app_version": string | null,"body": string,"case_no": number,"created_at": string,"emailed_at": string | null,"id": string,"page": string | null,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"body": string,"case_no"?: never,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"page"?: string | null,"user_agent"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "app_version"?: string | null,"body"?: string,"case_no"?: never,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"page"?: string | null,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_reports_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_reports_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"ticket_photos": {
                  Row: {
                    "created_at": string,"created_by": string | null,"height": number | null,"id": string,"path": string,"ticket_id": string,"update_id": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"height"?: number | null,"id"?: string,"path": string,"ticket_id": string,"update_id"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"height"?: number | null,"id"?: string,"path"?: string,"ticket_id"?: string,"update_id"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_photos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_photos_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "ticket_photos_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_photos_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "ticket_updates"
      referencedColumns: ["id"]
    }
                  ]
                },"ticket_updates": {
                  Row: {
                    "author_id": string | null,"body": string | null,"created_at": string,"id": string,"internal": boolean,"kind": Database["public"]['Enums']["update_kind"],"meta": NonNullable<Json>,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"internal"?: boolean,"kind"?: Database["public"]['Enums']["update_kind"],"meta"?: NonNullable<Json>,"ticket_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string | null,"created_at"?: string,"id"?: string,"internal"?: boolean,"kind"?: Database["public"]['Enums']["update_kind"],"meta"?: NonNullable<Json>,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_updates_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_updates_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "ticket_updates_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"tickets": {
                  Row: {
                    "assignee_id": string | null,"category_id": string,"closed_at": string | null,"closed_by": string | null,"created_at": string,"created_by": string,"description": string | null,"display_id": string | null,"equipment_id": string | null,"id": string,"last_closed_at": string | null,"number": number,"parent_ticket_id": string | null,"reopen_count": number,"reopened_at": string | null,"resolution": string | null,"restaurant_id": string,"scheduled_for": string | null,"source": Database["public"]['Enums']["ticket_source"],"status": Database["public"]['Enums']["ticket_status"],"title": string,"updated_at": string,"urgency": Database["public"]['Enums']["ticket_urgency"],"walkthrough_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"category_id": string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"display_id"?: never,"equipment_id"?: string | null,"id"?: string,"last_closed_at"?: string | null,"number": number,"parent_ticket_id"?: string | null,"reopen_count"?: number,"reopened_at"?: string | null,"resolution"?: string | null,"restaurant_id": string,"scheduled_for"?: string | null,"source"?: Database["public"]['Enums']["ticket_source"],"status"?: Database["public"]['Enums']["ticket_status"],"title": string,"updated_at"?: string,"urgency"?: Database["public"]['Enums']["ticket_urgency"],"walkthrough_id"?: string | null
                  }
                  Update: {
                    "assignee_id"?: string | null,"category_id"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"display_id"?: never,"equipment_id"?: string | null,"id"?: string,"last_closed_at"?: string | null,"number"?: number,"parent_ticket_id"?: string | null,"reopen_count"?: number,"reopened_at"?: string | null,"resolution"?: string | null,"restaurant_id"?: string,"scheduled_for"?: string | null,"source"?: Database["public"]['Enums']["ticket_source"],"status"?: Database["public"]['Enums']["ticket_status"],"title"?: string,"updated_at"?: string,"urgency"?: Database["public"]['Enums']["ticket_urgency"],"walkthrough_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "tickets_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "v_category_history"
      referencedColumns: ["category_id"]
    },{
      foreignKeyName: "tickets_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "tickets_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "tickets_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "v_equipment_history"
      referencedColumns: ["equipment_id"]
    },{
      foreignKeyName: "tickets_parent_ticket_id_fkey"
      columns: ["parent_ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "tickets_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "tickets_walkthrough_fk"
      columns: ["walkthrough_id"]
isOneToOne: false
      referencedRelation: "walkthroughs"
      referencedColumns: ["id"]
    }
                  ]
                },"two_step_codes": {
                  Row: {
                    "code_hash": string,"used_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash": string,"used_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "code_hash"?: string,"used_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "two_step_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "two_step_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"two_step_devices": {
                  Row: {
                    "expires_at": string,"token_hash": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: string,"token_hash": string,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"token_hash"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "two_step_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "two_step_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"two_step_passes": {
                  Row: {
                    "expires_at": string,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "expires_at"?: string,"session_id": string,"user_id": string
                  }
                  Update: {
                    "expires_at"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "two_step_passes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "two_step_passes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"two_step_resets": {
                  Row: {
                    "answered_at": string | null,"reset_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string | null,"reset_at"?: string,"user_id": string
                  }
                  Update: {
                    "answered_at"?: string | null,"reset_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "two_step_resets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "two_step_resets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"walkthrough_checks": {
                  Row: {
                    "checked_at": string,"checked_by": string | null,"id": string,"item_id": string | null,"note": string | null,"quarterly_task_id": string | null,"result": Database["public"]['Enums']["check_result"],"ticket_id": string | null,"walkthrough_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string,"checked_by"?: string | null,"id"?: string,"item_id"?: string | null,"note"?: string | null,"quarterly_task_id"?: string | null,"result": Database["public"]['Enums']["check_result"],"ticket_id"?: string | null,"walkthrough_id": string
                  }
                  Update: {
                    "checked_at"?: string,"checked_by"?: string | null,"id"?: string,"item_id"?: string | null,"note"?: string | null,"quarterly_task_id"?: string | null,"result"?: Database["public"]['Enums']["check_result"],"ticket_id"?: string | null,"walkthrough_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "walkthrough_checks_checked_by_fkey"
      columns: ["checked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthrough_checks_checked_by_fkey"
      columns: ["checked_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "walkthrough_checks_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "walkthrough_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthrough_checks_quarterly_task_id_fkey"
      columns: ["quarterly_task_id"]
isOneToOne: false
      referencedRelation: "quarterly_tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthrough_checks_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthrough_checks_walkthrough_id_fkey"
      columns: ["walkthrough_id"]
isOneToOne: false
      referencedRelation: "walkthroughs"
      referencedColumns: ["id"]
    }
                  ]
                },"walkthrough_items": {
                  Row: {
                    "active": boolean,"area": Database["public"]['Enums']["area"],"directions": string | null,"group_name": string,"id": string,"sort_order": number,"template_id": string,"title": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"area": Database["public"]['Enums']["area"],"directions"?: string | null,"group_name": string,"id"?: string,"sort_order"?: number,"template_id": string,"title": string,"video_url"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"area"?: Database["public"]['Enums']["area"],"directions"?: string | null,"group_name"?: string,"id"?: string,"sort_order"?: number,"template_id"?: string,"title"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "walkthrough_items_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "walkthrough_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"walkthrough_schedules": {
                  Row: {
                    "active": boolean,"due_day": number,"id": string,"months": (number)[],"reminder_days": (number)[],"restaurant_id": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"due_day"?: number,"id"?: string,"months"?: (number)[],"reminder_days"?: (number)[],"restaurant_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"due_day"?: number,"id"?: string,"months"?: (number)[],"reminder_days"?: (number)[],"restaurant_id"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "walkthrough_schedules_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthrough_schedules_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "walkthrough_schedules_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "walkthrough_schedules_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthrough_schedules_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    }
                  ]
                },"walkthrough_templates": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"walkthroughs": {
                  Row: {
                    "created_at": string,"due_on": string,"id": string,"period": string,"restaurant_id": string,"started_by": string | null,"status": Database["public"]['Enums']["walkthrough_status"],"submitted_at": string | null,"submitted_by": string | null,"template_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"due_on": string,"id"?: string,"period": string,"restaurant_id": string,"started_by"?: string | null,"status"?: Database["public"]['Enums']["walkthrough_status"],"submitted_at"?: string | null,"submitted_by"?: string | null,"template_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"due_on"?: string,"id"?: string,"period"?: string,"restaurant_id"?: string,"started_by"?: string | null,"status"?: Database["public"]['Enums']["walkthrough_status"],"submitted_at"?: string | null,"submitted_by"?: string | null,"template_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "walkthroughs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthroughs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "walkthroughs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "walkthroughs_started_by_fkey"
      columns: ["started_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthroughs_started_by_fkey"
      columns: ["started_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "walkthroughs_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "walkthroughs_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "v_person_history"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "walkthroughs_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "walkthrough_templates"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_category_equipment_counts": {
                  Row: {
                    "category_id": string,"equipment_count": number | null,"open_ticket_count": number | null,"restaurant_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "equipment_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "v_category_history"
      referencedColumns: ["category_id"]
    },{
      foreignKeyName: "equipment_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "equipment_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "equipment_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    }
                  ]
                },"v_category_history": {
                  Row: {
                    "category_id": string,"in_use": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                           "category_id"?: string | null,"in_use"?: never
                         }
                        Update: {
                           "category_id"?: string | null,"in_use"?: never
                         }
                        Relationships: [
                    
                  ]
                },"v_contractor_spend": {
                  Row: {
                    "contractor_id": string | null,"last_visit_on": string | null,"restaurant_id": string,"total_cents": number | null,"visits": number | null,"year": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_records_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    }
                  ]
                },"v_equipment_contractors": {
                  Row: {
                    "contractor_id": string | null,"equipment_id": string | null,"last_visit_on": string | null,"total_cents": number | null,"visits": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_records_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "v_equipment_history"
      referencedColumns: ["equipment_id"]
    }
                  ]
                },"v_equipment_history": {
                  Row: {
                    "equipment_id": string,"in_use": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                           "equipment_id"?: string | null,"in_use"?: never
                         }
                        Update: {
                           "equipment_id"?: string | null,"in_use"?: never
                         }
                        Relationships: [
                    
                  ]
                },"v_equipment_lifetime": {
                  Row: {
                    "equipment_id": string | null,"last_service_on": string | null,"total_cents": number | null,"visits": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "v_equipment_history"
      referencedColumns: ["equipment_id"]
    }
                  ]
                },"v_equipment_open_counts": {
                  Row: {
                    "equipment_id": string | null,"open_ticket_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "tickets_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "v_equipment_history"
      referencedColumns: ["equipment_id"]
    }
                  ]
                },"v_equipment_spend": {
                  Row: {
                    "equipment_id": string | null,"total_cents": number | null,"visits": number | null,"year": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "v_equipment_history"
      referencedColumns: ["equipment_id"]
    }
                  ]
                },"v_invoices_by_month": {
                  Row: {
                    "invoices": number | null,"missing": number | null,"month": string | null,"restaurant_id": string,"total_cents": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    }
                  ]
                },"v_missing_invoices": {
                  Row: {
                    "contractor_id": string | null,"equipment_id": string | null,"restaurant_id": string,"service_date": string,"service_record_id": string,"ticket_id": string | null,"total_cents": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_records_contractor_id_fkey"
      columns: ["contractor_id"]
isOneToOne: false
      referencedRelation: "contractors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "equipment"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_equipment_id_fkey"
      columns: ["equipment_id"]
isOneToOne: false
      referencedRelation: "v_equipment_history"
      referencedColumns: ["equipment_id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_history"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "service_records_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "v_restaurant_open_counts"
      referencedColumns: ["restaurant_id"]
    },{
      foreignKeyName: "service_records_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"v_person_history": {
                  Row: {
                    "records": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "records"?: never,"user_id"?: string | null
                         }
                        Update: {
                           "records"?: never,"user_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"v_restaurant_history": {
                  Row: {
                    "equipment": number | null,"home_of": number | null,"inhouse_fixes": number | null,"restaurant_id": string,"service_records": number | null,"tickets": number | null,"walkthroughs": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "equipment"?: never,"home_of"?: never,"inhouse_fixes"?: never,"restaurant_id"?: string | null,"service_records"?: never,"tickets"?: never,"walkthroughs"?: never
                         }
                        Update: {
                           "equipment"?: never,"home_of"?: never,"inhouse_fixes"?: never,"restaurant_id"?: string | null,"service_records"?: never,"tickets"?: never,"walkthroughs"?: never
                         }
                        Relationships: [
                    
                  ]
                },"v_restaurant_open_counts": {
                  Row: {
                    "open_count": number | null,"reopened_count": number | null,"restaurant_id": string,"urgent_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_service_record_totals": {
                  Row: {
                    "service_record_id": string,"total_cents": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_ticket_costs": {
                  Row: {
                    "last_service_on": string | null,"ticket_id": string | null,"total_cents": number | null,"visits": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "service_records_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_category":
{ Args: { "p_area": Database["public"]['Enums']["area"],"p_name": string }; Returns: string
                           },
"add_restaurant":
{ Args: { "p_address": string,"p_color": string,"p_manager_id"?: string,"p_name": string,"p_phone": string }; Returns: string
                           },
"attach_invoice":
{ Args: { "p_id": string,"p_path": string }; Returns: undefined
                           },
"can":
{ Args: { "action": string,"rid"?: string }; Returns: boolean
                           },
"can_edit_categories":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_post_on_ticket":
{ Args: { "tid": string }; Returns: boolean
                           },
"can_see_ticket":
{ Args: { "tid": string }; Returns: boolean
                           },
"can_see_ticket_photo":
{ Args: { "p_name": string }; Returns: boolean
                           },
"category_in_use":
{ Args: { "p_id": string }; Returns: boolean
                           },
"category_name_taken":
{ Args: { "p_area": Database["public"]['Enums']["area"],"p_except": string,"p_name": string }; Returns: boolean
                           },
"claim_notifications":
{ Args: { "p_limit"?: number }; Returns: {
              "actor_id": string | null,
"body": string | null,
"created_at": string,
"id": string,
"internal": boolean,
"kind": string,
"picked_up": boolean,
"processed_at": string | null,
"seq": number,
"status_to": string | null,
"ticket_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "notifications"
        isOneToOne: false
        isSetofReturn: true
      } },
"closed_by_month":
{ Args: { "p_restaurant_ids": (string)[],"p_time_zone": string }; Returns: {
              "closed_count": number,"month": string,"total_cents": number
            }[]
                           },
"delete_category":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_equipment":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_inhouse_fix":
{ Args: { "p_id": string }; Returns: undefined
                           },
"delete_restaurant":
{ Args: { "p_id": string }; Returns: undefined
                           },
"end_sessions":
{ Args: { "p_user": string }; Returns: undefined
                           },
"equipment_in_use":
{ Args: { "p_id": string }; Returns: boolean
                           },
"equipment_restaurant":
{ Args: { "eid": string }; Returns: string
                           },
"has_scope":
{ Args: { "rid": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_service":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_service":
{ Args: { "p_contractor_id"?: string,"p_equipment_id"?: string,"p_invoice_number"?: string,"p_kind": Database["public"]['Enums']["service_kind"],"p_labor_cents"?: number,"p_notes"?: string,"p_parts_cents"?: number,"p_restaurant_id"?: string,"p_service_date"?: string,"p_technician"?: string,"p_ticket_id"?: string,"p_title"?: string,"p_trip_cents"?: number }; Returns: string
                           },
"log_view_as":
{ Args: { "p_user": string }; Returns: undefined
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"new_backup_codes":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"notification_recipients":
{ Args: { "p_notification": string }; Returns: {
              "email": string,"full_name": string,"push": boolean,"send_email": boolean,"user_id": string
            }[]
                           },
"notify_problem":
{ Args: { "p_message": string }; Returns: undefined
                           },
"notify_send_push":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"path_uuid":
{ Args: { "object_name": string }; Returns: string
                           },
"person_two_step":
{ Args: { "p_user": string }; Returns: Json
                           },
"post_ticket_update":
{ Args: { "p_body": string,"p_internal"?: boolean,"p_paths"?: (string)[],"p_ticket_id": string }; Returns: string
                           },
"profile_photos_on":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"remember_device":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"rename_category":
{ Args: { "p_id": string,"p_name": string }; Returns: undefined
                           },
"reopen_ticket":
{ Args: { "p_id": string,"p_note": string,"p_paths"?: (string)[] }; Returns: undefined
                           },
"save_group_name":
{ Args: { "p_name": string,"p_short_name": string }; Returns: undefined
                           },
"save_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string }; Returns: undefined
                           },
"save_role_defaults":
{ Args: { "p_changes": Json }; Returns: undefined
                           },
"service_check_input":
{ Args: { "p_contractor_changed": boolean,"p_contractor_id": string,"p_kind": Database["public"]['Enums']["service_kind"],"p_labor_cents": number,"p_parts_cents": number,"p_service_date": string,"p_trip_cents": number }; Returns: undefined
                           },
"service_record_restaurant":
{ Args: { "srid": string }; Returns: string
                           },
"service_record_snapshot":
{ Args: { "p_id": string }; Returns: Json
                           },
"set_category_active":
{ Args: { "p_active": boolean,"p_id": string }; Returns: undefined
                           },
"set_equipment_retired":
{ Args: { "p_id": string,"p_retired": boolean }; Returns: undefined
                           },
"set_inhouse_fix_done":
{ Args: { "p_done": boolean,"p_id": string }; Returns: undefined
                           },
"set_person_access":
{ Args: { "p_restaurants": (string)[],"p_role": Database["public"]['Enums']["app_role"],"p_user": string }; Returns: undefined
                           },
"set_person_rights":
{ Args: { "p_rights": Json,"p_user": string }; Returns: undefined
                           },
"set_profile_photos":
{ Args: { "p_on": boolean }; Returns: undefined
                           },
"set_restaurant_archived":
{ Args: { "p_archived": boolean,"p_id": string }; Returns: undefined
                           },
"set_service_amount":
{ Args: { "p_cents": number,"p_id": string,"p_kind": Database["public"]['Enums']["line_item_kind"] }; Returns: undefined
                           },
"set_ticket_status":
{ Args: { "p_id": string,"p_scheduled_for"?: string,"p_status": Database["public"]['Enums']["ticket_status"] }; Returns: undefined
                           },
"take_ticket":
{ Args: { "p_id": string }; Returns: undefined
                           },
"ticket_restaurant":
{ Args: { "tid": string }; Returns: string
                           },
"two_step_code_hash":
{ Args: { "p_code": string,"p_user": string }; Returns: string
                           },
"two_step_forget_trust":
{ Args: { "p_user": string }; Returns: undefined
                           },
"two_step_ok":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"two_step_required":
{ Args: { "p_user": string }; Returns: boolean
                           },
"two_step_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"update_restaurant":
{ Args: { "p_address": string,"p_color": string,"p_id": string,"p_name": string,"p_phone": string }; Returns: undefined
                           },
"update_service_record":
{ Args: { "p_contractor_id"?: string,"p_equipment_id"?: string,"p_id": string,"p_invoice_number"?: string,"p_kind": Database["public"]['Enums']["service_kind"],"p_labor_cents"?: number,"p_notes"?: string,"p_parts_cents"?: number,"p_restaurant_id"?: string,"p_service_date": string,"p_technician"?: string,"p_ticket_id"?: string,"p_title"?: string,"p_trip_cents"?: number }; Returns: undefined
                           },
"use_backup_code":
{ Args: { "p_code": string }; Returns: string
                           },
"use_remembered_device":
{ Args: { "p_token": string }; Returns: boolean
                           },
"walkthrough_restaurant":
{ Args: { "wid": string }; Returns: string
                           }
          }
          Enums: {
            "app_role": "manager"|"ops"|"leadership"|"admin","area": "foh"|"boh","check_result": "good"|"in_house"|"ticket","invite_status": "pending"|"accepted"|"revoked","invoice_status": "attached"|"missing","line_item_kind": "labor"|"parts"|"trip","service_kind": "in_house"|"contractor","ticket_source": "reported"|"walkthrough","ticket_status": "open"|"in_progress"|"waiting_parts"|"scheduled"|"reopened"|"closed","ticket_urgency": "low"|"normal"|"urgent","update_kind": "message"|"created"|"assigned"|"status_changed"|"closed"|"reopened","walkthrough_status": "open"|"submitted"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["manager", "ops", "leadership", "admin"],"area": ["foh", "boh"],"check_result": ["good", "in_house", "ticket"],"invite_status": ["pending", "accepted", "revoked"],"invoice_status": ["attached", "missing"],"line_item_kind": ["labor", "parts", "trip"],"service_kind": ["in_house", "contractor"],"ticket_source": ["reported", "walkthrough"],"ticket_status": ["open", "in_progress", "waiting_parts", "scheduled", "reopened", "closed"],"ticket_urgency": ["low", "normal", "urgent"],"update_kind": ["message", "created", "assigned", "status_changed", "closed", "reopened"],"walkthrough_status": ["open", "submitted"]
          }
        }
} as const
