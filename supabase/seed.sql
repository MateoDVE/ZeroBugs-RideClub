insert into public.companies(id,slug,name,access_email,subtitle,logo_url,color,website_url,status) values
('00000000-0000-4000-8000-000000000001','zontes','Zontes','zontes@gmail.com','Tecnología que abre caminos','/assets/zontes-logo.png','#c6f46a','https://zontesbolivia.com/','active'),
('00000000-0000-4000-8000-000000000002','niu','NIU','niu@gmail.com','La ciudad se mueve en eléctrico','/assets/niu-logo.png','#ff6d6d','https://www.niu.com/','active'),
('00000000-0000-4000-8000-000000000003','kiden','Kiden','kiden@gmail.com','Tu ritmo. Tus propias reglas.','/assets/kiden-logo.png','#ffb86b','https://www.kiden.cn/','active')
on conflict (id) do nothing;

insert into public.point_rules(company_id,kind,points,expiry_days)
select c.id, r.kind::public.activity_kind, r.points, 365
from public.companies c
cross join (values ('purchase',1000),('maintenance',500),('referral',200),('event',50)) r(kind,points)
on conflict (company_id,kind) do update set points=excluded.points,expiry_days=excluded.expiry_days;

insert into public.bikes(external_key,company_id,name,category,tag,description,image_url,price_usdt,source_url,region,specs) values
('z703f','00000000-0000-4000-8000-000000000001','703F','Adventure','Para ir más allá','Adventure tricilíndrica con equipamiento premium para recorrer ciudad y carretera.','/assets/zontes-703f.jpg',11490,'https://zontesbolivia.com/motos/','Catálogo Bolivia','[["Motor","699 cc"],["Potencia","70 kW"],["Frenos","ABS"],["Uso","Adventure"]]'),
('zgk350','00000000-0000-4000-8000-000000000001','GK350','Neo-retro','Diseño que deja huella','Neo-retro de media cilindrada con iluminación LED y equipamiento para el día a día.','/assets/zontes-gk350.jpg',6490,'https://zontesbolivia.com/motos/','Catálogo Bolivia','[["Motor","348 cc"],["Estilo","Neo-retro"],["Frenos","ABS"],["Iluminación","LED"]]'),
('zgk200','00000000-0000-4000-8000-000000000001','GK200','Urbana','Hecha para la ciudad','Una urbana ágil con estética scrambler y tecnología para moverte todos los días.','/assets/zontes-gk200.jpg',3490,'https://zontesbolivia.com/motos/','Catálogo Bolivia','[["Motor","198 cc"],["Estilo","Scrambler"],["Frenos","Disco"],["Uso","Urbano"]]'),
('nnqi','00000000-0000-4000-8000-000000000002','NQi Sport MY26','Eléctrica','Muévete inteligente','Scooter eléctrica urbana con conectividad y batería extraíble.','/assets/niu-nqi-sport.webp',3990,'https://www.niu.com/','Catálogo Bolivia','[["Motor","Eléctrico"],["Batería","Extraíble"],["Conectividad","App NIU"],["Uso","Urbano"]]'),
('nnqix300','00000000-0000-4000-8000-000000000002','NQiX 300 MY26','Eléctrica','Energía para tu día','Movilidad eléctrica de nueva generación para una conducción urbana conectada.','/assets/niu-nqix300.webp',5490,'https://www.niu.com/','Catálogo Bolivia','[["Motor","Eléctrico"],["Serie","NQiX"],["Conectividad","Inteligente"],["Uso","Ciudad"]]'),
('nnqix500','00000000-0000-4000-8000-000000000002','NQiX 500 MY26','Eléctrica','Más potencia eléctrica','El modelo de mayor desempeño de la línea NQiX para rutas urbanas más exigentes.','/assets/niu-nqix500.webp',7490,'https://www.niu.com/','Catálogo Bolivia','[["Motor","Eléctrico"],["Serie","NQiX"],["Nivel","Premium"],["Uso","Urbano"]]'),
('k150z','00000000-0000-4000-8000-000000000003','KD150-Z','Urbana','Tu primera gran ruta','Una naked ligera de entrada para moverte con personalidad.','/assets/kiden-kd150z.jpg',null,'https://motofun.com.ar/','Referencia Argentina','[["Motor","150 cc"],["Estilo","Naked"],["Frenos","Disco"],["Disponibilidad Bolivia","Por confirmar"]]'),
('k250v','00000000-0000-4000-8000-000000000003','KD250-V','Neo-retro','Clásica por fuera. Actual por dentro.','Estética retro con inyección electrónica, horquilla invertida y frenos de disco.','/assets/kiden-kd250v.jpg',null,'https://motofun.com.ar/product/kd250-v/','Referencia Argentina','[["Inyección","Electrónica"],["Suspensión","Horquilla invertida"],["Frenos","Disco"],["Disponibilidad Bolivia","Por confirmar"]]'),
('k150gk','00000000-0000-4000-8000-000000000003','KD150-GK','Scrambler','Deja tu propia huella','Una scrambler con motor refrigerado por agua, encendido sin llave y ABS.','/assets/kiden-kd150gk.jpg',null,'https://m.kiden.cn/','Catálogo internacional','[["Motor","150 cc"],["Potencia","14 kW"],["Seguridad","ABS doble canal"],["Disponibilidad Bolivia","Por confirmar"]]')
on conflict (external_key) do nothing;

insert into public.rewards(external_key,company_id,title,kind,category,points,detail,terms,validity_days,stock)
select c.slug::text || '-service',c.id,case when c.name='NIU' then 'Diagnóstico eléctrico' else 'Mantenimiento básico' end,'service','Servicio',500,
case when c.name='NIU' then 'Revisión de batería, frenos y sistema eléctrico.' else 'Revisión general y mano de obra de mantenimiento preventivo.' end,
case when c.name='NIU' then 'Una revisión de diagnóstico. No incluye reparación, batería ni repuestos.' else 'Una revisión y ajuste preventivo. No incluye aceite, consumibles ni repuestos.' end,60,20
from public.companies c
on conflict (external_key) do nothing;

insert into public.rewards(external_key,company_id,title,kind,category,points,detail,terms,validity_days,stock)
select c.slug::text || '-parts',c.id,case when c.name='NIU' then 'Accesorios para tu NIU' else 'Repuestos para tu moto' end,'parts',case when c.name='NIU' then 'Accesorios' else 'Repuestos' end,350,
'Un 10% de descuento en una compra de productos compatibles.','10% sobre una compra de hasta 100 USDT. Sujeto a disponibilidad; no acumulable.',30,30
from public.companies c
on conflict (external_key) do nothing;

insert into public.rewards(external_key,company_id,title,kind,category,points,detail,terms,validity_days,stock)
select c.slug::text || '-care',c.id,'Limpieza y revisión','care','Cuidado',250,
'Una puesta a punto visual y limpieza exterior.','Limpieza exterior y revisión visual. No incluye reparación.',30,25
from public.companies c
on conflict (external_key) do nothing;
