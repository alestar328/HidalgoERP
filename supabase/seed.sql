-- Datos de ejemplo: puesto de uniformes y útiles escolares.
--
-- Cómo usarlo:
--   1. Entra a la app con tu correo y crea tu negocio.
--   2. Pega este archivo en Supabase → SQL Editor y ejecútalo.
-- Carga los datos en el negocio MÁS ANTIGUO de la base (el tuyo, si recién empiezas).
-- Para otro negocio, cambia la línea marcada con «elige el negocio».
-- Se puede ejecutar varias veces: si los productos ya están, no hace nada.
--
-- Fase (a): categorías, productos, variantes, costos y stock inicial.
-- Clientes con deuda y ventas de la última semana se agregan en las fases (b) y (d).

do $$
declare
  v_org  uuid;
  v_cat  uuid;
  v_id   uuid;
  v_var  uuid;
  r      record;
  t      record;
begin
  select id into v_org from public.organizations order by created_at limit 1;  -- «elige el negocio»
  if v_org is null then
    raise exception 'Primero entra a la app y crea tu negocio; después ejecuta este seed.';
  end if;
  if exists (select 1 from public.products where organization_id = v_org and sku = 'UTI-CUA-A4C') then
    raise notice 'Los datos de ejemplo ya estaban cargados. No se hizo nada.';
    return;
  end if;

  insert into public.categories (organization_id, name)
  select v_org, c from unnest(array['Uniformes', 'Buzos y deporte', 'Cuadernos y papel', 'Escritura', 'Arte y manualidades', 'Mochilas y accesorios']) c
  on conflict do nothing;

  -- ---------------------------------------------------------- productos simples
  -- (categoría, nombre, sku, unidad, precio, por mayor, desde, costo, stock, mínimo)
  for r in
    select * from (values
      ('Cuadernos y papel',    'Cuaderno cuadriculado A4 100 hojas',  'UTI-CUA-A4C', 'unidad',  6.50,  5.80, 12,  4.60, 144, 24),
      ('Cuadernos y papel',    'Cuaderno rayado A4 100 hojas',        'UTI-CUA-A4R', 'unidad',  6.50,  5.80, 12,  4.60,  96, 24),
      ('Cuadernos y papel',    'Cuaderno triple renglón A4 92 hojas', 'UTI-CUA-A4T', 'unidad',  7.00,  6.20, 12,  5.00,  18, 24),
      ('Cuadernos y papel',    'Papel bond A4 75 g (millar)',         'UTI-BON-A4',  'caja',   26.00, 24.00,  5, 21.50,  12,  4),
      ('Cuadernos y papel',    'Fólder manila A4',                    'UTI-FOL-A4',  'unidad',  0.50,  0.35, 25,  0.22, 300, 50),
      ('Cuadernos y papel',    'Forro plástico para cuaderno A4',     'UTI-FOR-A4',  'unidad',  1.50,  1.10, 12,  0.75,   0, 30),
      ('Escritura',            'Lapicero azul punta fina',            'UTI-LAP-AZ',  'unidad',  1.00,  0.70, 12,  0.48, 240, 48),
      ('Escritura',            'Lapicero rojo punta fina',            'UTI-LAP-RO',  'unidad',  1.00,  0.70, 12,  0.48, 120, 48),
      ('Escritura',            'Lápiz 2B con borrador',               'UTI-LPZ-2B',  'unidad',  1.00,  0.75, 12,  0.50,  36, 48),
      ('Escritura',            'Borrador blanco',                     'UTI-BOR-BL',  'unidad',  1.00,  0.70, 12,  0.40,  90, 24),
      ('Escritura',            'Tajador con depósito',                'UTI-TAJ-DP',  'unidad',  1.50,  1.10, 12,  0.70,  60, 24),
      ('Escritura',            'Regla 30 cm',                         'UTI-REG-30',  'unidad',  1.50,  1.10, 12,  0.75,  48, 12),
      ('Arte y manualidades',  'Colores x 12 largos',                 'UTI-COL-12',  'unidad',  8.50,  7.50,  6,  6.00,  40, 10),
      ('Arte y manualidades',  'Plumones delgados x 12',              'UTI-PLU-12',  'unidad',  9.00,  8.00,  6,  6.40,   8, 10),
      ('Arte y manualidades',  'Témperas x 7 colores',                'UTI-TEM-07',  'unidad',  7.50,  6.50,  6,  5.10,  22,  8),
      ('Arte y manualidades',  'Goma en barra 21 g',                  'UTI-GOM-21',  'unidad',  3.00,  2.50, 12,  1.80,  54, 12),
      ('Arte y manualidades',  'Tijera escolar punta roma',           'UTI-TIJ-PR',  'unidad',  3.50,  2.90, 12,  2.10,  30, 12),
      ('Arte y manualidades',  'Cartulina blanca (pliego)',           'UTI-CAR-BL',  'unidad',  1.00,  0.80, 10,  0.50, 150, 30),
      ('Mochilas y accesorios','Mochila escolar reforzada',           'ACC-MOC-RF',  'unidad', 65.00, 58.00,  3, 44.00,   9,  3),
      ('Mochilas y accesorios','Cartuchera doble cierre',             'ACC-CAR-DC',  'unidad', 12.00, 10.00,  6,  7.50,  25,  6),
      ('Mochilas y accesorios','Lonchera térmica',                    'ACC-LON-TR',  'unidad', 28.00, 25.00,  3, 19.00,   0,  4),
      ('Uniformes',            'Corbata escolar azul',                'UNI-COR-AZ',  'unidad',  8.00,  6.50,  6,  4.20,  35,  6),
      ('Uniformes',            'Insignia bordada del colegio',        'UNI-INS-BD',  'unidad',  5.00,  4.00, 10,  2.30,  80, 15),
      ('Uniformes',            'Medias blancas escolares (par)',      'UNI-MED-BL',  'unidad',  5.00,  4.20, 12,  3.00,  14, 24)
    ) as x(cat, name, sku, unit, retail, wholesale, min_qty, cost, stock, min_stock)
  loop
    select id into v_cat from public.categories where organization_id = v_org and name = r.cat;
    insert into public.products (organization_id, name, sku, category_id, unit, retail_price, wholesale_price, wholesale_min_qty, min_stock)
    values (v_org, r.name, r.sku, v_cat, r.unit::public.product_unit, r.retail, r.wholesale, r.min_qty, r.min_stock)
    returning id into v_id;
    insert into public.product_costs (product_id, organization_id, cost) values (v_id, v_org, r.cost);
    if r.stock > 0 then
      insert into public.stock_movements (organization_id, product_id, type, qty, reason)
      values (v_org, v_id, 'initial', r.stock, 'Datos de ejemplo');
    end if;
  end loop;

  -- ---------------------------------------------------------- productos con tallas
  -- (categoría, nombre, prefijo sku, precio base, por mayor, desde, costo base)
  for r in
    select * from (values
      ('Uniformes',       'Camisa blanca escolar manga corta', 'UNI-CAM', 22.00, 19.00, 6, 13.50),
      ('Uniformes',       'Pantalón gris escolar',             'UNI-PAN', 35.00, 31.00, 6, 23.00),
      ('Uniformes',       'Falda gris escolar plisada',        'UNI-FAL', 32.00, 28.00, 6, 21.00),
      ('Uniformes',       'Chompa azul escolar',               'UNI-CHO', 38.00, 34.00, 6, 26.00),
      ('Buzos y deporte', 'Buzo escolar (casaca y pantalón)',  'UNI-BUZ', 60.00, 54.00, 6, 41.00)
    ) as x(cat, name, sku, retail, wholesale, min_qty, cost)
  loop
    select id into v_cat from public.categories where organization_id = v_org and name = r.cat;
    insert into public.products (organization_id, name, sku, category_id, unit, retail_price, wholesale_price, wholesale_min_qty)
    values (v_org, r.name, r.sku, v_cat, 'unidad', r.retail, r.wholesale, r.min_qty)
    returning id into v_id;
    insert into public.product_costs (product_id, organization_id, cost) values (v_id, v_org, r.cost);

    -- Tallas: las grandes cuestan un poco más. Algunas quedan bajas o agotadas a propósito.
    for t in
      select * from (values
        ('08', 'Talla 8',  0.00,  9),
        ('10', 'Talla 10', 0.00, 12),
        ('12', 'Talla 12', 2.00,  3),
        ('14', 'Talla 14', 3.00,  7),
        ('16', 'Talla 16', 5.00,  0)
      ) as y(code, label, extra, stock)
    loop
      insert into public.products (organization_id, parent_id, name, variant_label, sku, category_id, unit,
                                   retail_price, wholesale_price, wholesale_min_qty, min_stock)
      values (v_org, v_id, r.name, t.label, r.sku || '-' || t.code, v_cat, 'unidad',
              r.retail + t.extra, r.wholesale + t.extra, r.min_qty, 3)
      returning id into v_var;
      insert into public.product_costs (product_id, organization_id, cost) values (v_var, v_org, r.cost + t.extra * 0.6);
      -- El buzo vende menos tallas chicas: varía un poco el stock por producto.
      if t.stock > 0 and not (r.sku = 'UNI-FAL' and t.code = '08') then
        insert into public.stock_movements (organization_id, product_id, type, qty, reason)
        values (v_org, v_var, 'initial', t.stock + (case when r.sku = 'UNI-CAM' then 6 else 0 end), 'Datos de ejemplo');
      end if;
    end loop;
  end loop;

  raise notice 'Datos de ejemplo cargados en el negocio %', v_org;
end $$;
