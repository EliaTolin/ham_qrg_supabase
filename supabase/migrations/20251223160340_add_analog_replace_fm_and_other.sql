-- Step 1: Aggiungi 'Analog' all'enum repeater_mode (se non esiste già)
do $$ 
begin
  if not exists (
    select 1 from pg_enum 
    where enumlabel = 'Analog' 
    and enumtypid = 'public.repeater_mode'::regtype
  ) then
    alter type public.repeater_mode add value 'Analog';
  end if;
end $$;


