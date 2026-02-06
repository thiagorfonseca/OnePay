alter table public.hr_departments
  add column if not exists name_normalized text;

update public.hr_departments
set name_normalized = lower(
  regexp_replace(
    translate(
      name,
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
      'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',
    ' ',
    'g'
  )
)
where name_normalized is null;

alter table public.hr_departments
  add constraint hr_departments_clinic_id_name_norm_key unique (clinic_id, name_normalized);
