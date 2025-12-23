-- Step 2: Aggiorna tutti i record da 'Other' a 'Analog'
update public.repeaters
set mode = 'Analog'::public.repeater_mode
where mode = 'Other'::public.repeater_mode;

-- Step 3: Aggiorna tutti i record da 'FM' a 'Analog'
update public.repeaters
set mode = 'Analog'::public.repeater_mode
where mode = 'FM'::public.repeater_mode;

-- Step 4: Cambia il default della colonna mode da 'Other' a 'Analog'
alter table public.repeaters
alter column mode set default 'Analog'::public.repeater_mode;



