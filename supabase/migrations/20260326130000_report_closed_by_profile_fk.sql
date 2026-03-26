-- Add FK from repeater_reports.closed_by to profiles
-- so PostgREST can resolve the join directly
ALTER TABLE public.repeater_reports
  ADD CONSTRAINT repeater_reports_closed_by_profile_fk
  FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
