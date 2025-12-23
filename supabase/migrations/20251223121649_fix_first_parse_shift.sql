create or replace function public.parse_shift_hz(shift_text text)
returns integer
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

  -- estrai solo cifre e separatori
  num_text := nullif(regexp_replace(t, '[^0-9\.,]', '', 'g'), '');

  if num_text is null then
    return null;
  end if;

  -- Normalizza formato IT:
  -- se ci sono sia '.' che ',' => '.' migliaia, ',' decimali
  if position('.' in num_text) > 0 and position(',' in num_text) > 0 then
    num_text := replace(num_text, '.', '');
    num_text := replace(num_text, ',', '.');
  else
    -- se solo ',' => decimali
    if position(',' in num_text) > 0 then
      num_text := replace(num_text, ',', '.');
    end if;
  end if;

  -- ora è safe
  num := num_text::numeric;

  if t ilike '%mhz%' then
    return (sign * (num * 1000000))::int;
  elsif t ilike '%khz%' then
    return (sign * (num * 1000))::int;
  else
    return null;
  end if;
end $$;