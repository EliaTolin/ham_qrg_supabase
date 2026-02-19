-- 1) shift_hz: int -> bigint
alter table public.repeaters
  alter column shift_hz type bigint;

-- 2) drop function (serve perché cambia return type)
drop function if exists public.parse_shift_hz(text) cascade;

-- 3) recreate function with bigint return + IT number normalization
create function public.parse_shift_hz(shift_text text)
returns bigint
language plpgsql
as $$
declare
  t text := trim(coalesce(shift_text,''));
  sign int := 1;
  num_text text;
  num numeric;
begin
  if t = '' or t = '0' then
    return 0;
  end if;

  if left(t,1) = '-' then
    sign := -1;
  end if;

  num_text := nullif(regexp_replace(t, '[^0-9\.,]', '', 'g'), '');
  if num_text is null then
    return null;
  end if;

  -- normalize Italian format: "1.362,5" -> "1362.5"
  if position('.' in num_text) > 0 and position(',' in num_text) > 0 then
    num_text := replace(num_text, '.', '');
    num_text := replace(num_text, ',', '.');
  else
    if position(',' in num_text) > 0 then
      num_text := replace(num_text, ',', '.');
    end if;
  end if;

  num := num_text::numeric;

  if t ilike '%mhz%' then
    return (sign * (num * 1000000))::bigint;
  elsif t ilike '%khz%' then
    return (sign * (num * 1000))::bigint;
  else
    return null;
  end if;
end $$;

-- 4) Recreate trigger function (in case it was dropped by CASCADE)
create or replace function public.repeaters_fill_fields()
returns trigger
language plpgsql
as $$
declare
  g geography;
begin
  if new.callsign is not null then
    new.callsign := nullif(upper(trim(new.callsign)), '');
  end if;

  if new.ctcss_hz is null and new.tone_raw is not null then
    new.ctcss_hz := public.try_parse_ctcss(new.tone_raw);
  end if;

  if new.shift_hz is null and new.shift_raw is not null then
    new.shift_hz := public.parse_shift_hz(new.shift_raw);
  end if;

  if new.lat is not null and new.lon is not null then
    new.geom := st_setsrid(st_makepoint(new.lon, new.lat), 4326)::geography;
  elsif new.locator is not null then
    g := public.maidenhead_to_point(new.locator);
    new.geom := g;
    if g is not null then
      new.lon := st_x(g::geometry);
      new.lat := st_y(g::geometry);
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_repeaters_fill_fields on public.repeaters;
create trigger trg_repeaters_fill_fields
before insert or update on public.repeaters
for each row execute function public.repeaters_fill_fields();