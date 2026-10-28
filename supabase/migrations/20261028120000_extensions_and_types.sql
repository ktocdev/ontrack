-- OnTrack schema, part 1 of 8: extensions and enum types.
-- Every later migration builds on these. Enums are deliberately narrow; a new
-- status or role is a migration, not a free-text value.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;

-- Roles are one per person. Scope (which restaurants) lives in memberships.
create type public.app_role as enum ('manager', 'ops', 'leadership', 'admin');

-- Front of house / back of house. Categories carry an area; tickets inherit it.
create type public.area as enum ('foh', 'boh');

create type public.ticket_status as enum (
  'open',
  'in_progress',
  'waiting_parts',
  'scheduled',
  'reopened',
  'closed'
);

create type public.ticket_urgency as enum ('normal', 'urgent');

-- Where a ticket came from: reported by someone, or raised during a walkthrough.
create type public.ticket_source as enum ('reported', 'walkthrough');

-- Rows in the ticket thread. 'message' is written by people; the rest are
-- system events written by triggers.
create type public.update_kind as enum (
  'message',
  'created',
  'assigned',
  'status_changed',
  'closed',
  'reopened'
);

-- Invites: 'expired' is derived from expires_at, never stored.
create type public.invite_status as enum ('pending', 'accepted', 'revoked');

create type public.service_kind as enum ('in_house', 'contractor');
create type public.line_item_kind as enum ('labor', 'parts', 'trip');
create type public.invoice_status as enum ('attached', 'missing');

create type public.check_result as enum ('good', 'in_house', 'ticket');
create type public.walkthrough_status as enum ('open', 'submitted');

-- Shared trigger: keep updated_at honest on every table that has one.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
