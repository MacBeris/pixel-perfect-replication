-- Review mutations are handled by authenticated server functions using the
-- service-role client. Keep public clients read-only and rely on the existing
-- ownership checks in those server functions.
revoke insert, update, delete on table public.reviews from anon, authenticated;
