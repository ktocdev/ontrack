-- OT-115: IT is an area of its own beside Front and Back of House (decided Nov 16, 2026,
-- OT-113). POS and tech problems go to the group's IT department, who work the same
-- tickets as Ops; with their own area, Create ticket asks Front, Back or IT, and the
-- people who don't handle IT can set it aside in My categories (OT-116 on).
--
-- On its own, since Postgres can't use a new enum value in the transaction that adds it;
-- the next migration adds IT's categories.
alter type public.area add value if not exists 'it';
