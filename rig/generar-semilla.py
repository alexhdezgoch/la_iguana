# Genera supabase/seed/*.json para La Iguana a partir de los datos de la demo.
import json, math, os, copy, random
from datetime import date, timedelta

OUT = '/home/user/la_iguana/supabase/seed'
TZ = '-04:00'
D0 = date(2027, 4, 14)  # día 0 del periodo de 30 días
DIAS = [D0 + timedelta(days=i) for i in range(30)]

def ts(d, h='00:00'):
    return f'{d}T{h}:00{TZ}'

def jround(x):  # Math.round de JS
    return math.floor(x + 0.5)

def reparto(pesos, total):
    """Enteros que reproducen la forma de `pesos` y suman `total` (mayor residuo)."""
    s = sum(pesos)
    if s == 0:
        return [0] * len(pesos)
    exactos = [p * total / s for p in pesos]
    base = [math.floor(e) for e in exactos]
    faltan = total - sum(base)
    orden = sorted(range(len(pesos)), key=lambda i: -(exactos[i] - base[i]))
    for i in orden[:faltan]:
        base[i] += 1
    return base

# Fuentes genéricas: la semilla nunca usa nombres de medios reales (ver docs/semilla.md, "Fuentes").
MD, PN, DN, ER, TV, TVN, MR, DD = ('Medio digital nacional', 'Portal de noticias', 'Diario nacional', 'Emisora de radio',
                                   'Canal de TV', 'Canal de noticias de TV', 'Medio regional', 'Diario digital')
SIN_AFILIACION = 'Cuentas sin afiliación pública'

T = {}  # tabla -> filas
def add(tabla, fila):
    T.setdefault(tabla, []).append(fila)

# ====================================================================
# Equipo
# ====================================================================
add('organizaciones', {'id': 'brujula', 'nombre': 'Brújula Estrategia Pública', 'iniciales': 'BE'})
PERSONAS = [
    ('lucia', 'Lucía G.', 'Lucía G.', 'LG', None, 'Analista de guardia', 'admin'),
    ('daniela', 'Daniela P.', 'Daniela P.', 'DP', None, None, 'miembro'),
    ('andres', 'Andrés M.', 'Andrés M.', 'AM', None, None, 'miembro'),
    ('carla', 'Carla R.', 'Carla R.', 'CR', None, None, 'miembro'),
    ('andrea', 'Andrea', 'Andrea', 'AN', None, 'Coordinación digital', 'miembro'),
    ('tomas', 'Tomás Arráiz', 'Tomás A.', 'TA', None, 'Director de estrategia', 'miembro'),
    ('valentina', 'Valentina Ríos', 'Valentina R.', 'VR', 'valentina@brujula.example', None, 'miembro'),
    ('andres-v', 'Andrés Villalobos', 'Andrés V.', 'AV', 'andres@brujula.example', None, 'miembro'),
    ('carolina', 'Carolina Atencio', 'Carolina A.', 'CA', 'carolina@brujula.example', None, 'miembro'),
]
for pid, nombre, corto, ini, email, puesto, rol in PERSONAS:
    f = {'id': pid, 'org_id': 'brujula', 'nombre': nombre, 'nombre_corto': corto, 'iniciales': ini, 'rol_org': rol}
    if email: f['email'] = email
    if puesto: f['puesto'] = puesto
    add('personas', f)

# ====================================================================
# Campañas
# ====================================================================
LISTAS = [
    {'id': 'comando', 'nombre': 'Comando (ejemplo)', 'descripcion': '7 contactos de ejemplo del equipo de campaña', 'personas': 7},
    {'id': 'candidata', 'nombre': 'Figura propia (ejemplo)', 'descripcion': '2 contactos de ejemplo de la figura propia', 'personas': 2},
    {'id': 'cliente', 'nombre': 'Cliente (ejemplo)', 'descripcion': 'Contactos del cliente (ejemplo)', 'personas': 2},
]
base_c = {'org_id': 'brujula', 'pais': 'Venezuela', 'fecha_corte': '2027-05-13', 'periodo_inicio': '2027-04-14',
          'periodo_fin': '2027-05-13', 'es_demo': True}
add('campanas', dict(base_c, id='presidenciales', nombre='María Corina Machado', nombre_corto='Presidenciales', contienda='Presidenciales 2027',
    titulo_largo='Presidenciales Venezuela 2027', iniciales='MM', ambito='Presidenciales', territorio='Venezuela',
    fase='Campaña', inicio_campana='2027-04-04', fin_campana='2027-06-02', veda_inicio='2027-06-03', veda_fin='2027-06-05',
    jornada='2027-06-06', figura_propia_id='machado', vista='completa', orden=1,
    extra={'nota_temas': 'El primer debate movió Economía y salarios. Desde el 4 de mayo crece Fecha electoral, por la mesa de diálogo.',
           'listas_destinatarios': LISTAS,
           'marca_cliente': {'nombre': 'Cliente de ejemplo · escenario hipotético', 'iniciales': 'CE'}}))
add('campanas', dict(base_c, id='zulia', nombre='Gobernación del Zulia', nombre_corto='Zulia', contienda='Regionales 2027', titulo_largo='Gobernación del Zulia',
    iniciales='GZ', ambito='Regionales', territorio='Zulia', fase='Precampaña', figura_propia_id='rosales', vista='compacta', orden=2,
    extra={'nota_temas': 'El servicio eléctrico concentra casi un tercio de la conversación y es el tema que más crece: 38% en 48 horas en Maracaibo.',
           'avance_fase': 18}))
add('campanas', dict(base_c, id='chacao', nombre='Alcaldía de Chacao', nombre_corto='Chacao', contienda='Municipales 2027', titulo_largo='Alcaldía de Chacao',
    iniciales='AC', ambito='Municipales', territorio='Chacao, Miranda', fase='Precampaña', figura_propia_id='duque', vista='compacta', orden=3,
    extra={'nota_temas': 'Movilidad es el tema con más volumen del periodo y el de la única alerta abierta de la campaña.',
           'avance_fase': 10}))

for cid, pid, rol in [('presidenciales', 'lucia', 'Administración'), ('presidenciales', 'daniela', 'Análisis'),
                      ('presidenciales', 'andres', 'Análisis'), ('presidenciales', 'carla', 'Análisis'),
                      ('presidenciales', 'andrea', 'Análisis'), ('presidenciales', 'tomas', 'Análisis'),
                      ('zulia', 'lucia', 'Administración'), ('zulia', 'andres', 'Análisis'),
                      ('chacao', 'lucia', 'Administración')]:
    pre = {'presidenciales': 'pres', 'zulia': 'zulia', 'chacao': 'chacao'}[cid]
    add('miembros_campana', {'id': f'{pre}-m-{pid}', 'campana_id': cid, 'persona_id': pid, 'rol': rol})

for fid, cid, nombre, ini, fin, orden in [
    ('pres-fase-precampana', 'presidenciales', 'Precampaña', None, '2027-04-03', 1),
    ('pres-fase-campana', 'presidenciales', 'Campaña', '2027-04-04', '2027-06-02', 2),
    ('pres-fase-veda', 'presidenciales', 'Veda', '2027-06-03', '2027-06-05', 3),
    ('pres-fase-jornada', 'presidenciales', 'Jornada electoral', '2027-06-06', '2027-06-06', 4),
    ('zulia-fase-precampana', 'zulia', 'Precampaña', None, None, 1),
    ('chacao-fase-precampana', 'chacao', 'Precampaña', None, None, 1)]:
    add('campana_fases', {'id': fid, 'campana_id': cid, 'nombre': nombre, 'inicio': ini, 'fin': fin, 'orden': orden})

# ====================================================================
# Figuras
# ====================================================================
FIGS = [
    # Cargos: roles descriptivos y neutros. No afirman cargos públicos vigentes ni candidaturas de personas reales.
    ('machado', 'MM', 'María Corina Machado', 'Dirigente opositora', 'Vente Venezuela', 'Plataforma Unitaria Democrática',
     {'subtitulo': 'Nobel de la Paz 2025'}),
    ('delcy-rodriguez', 'DR', 'Delcy Rodríguez', 'Dirigente del PSUV', 'PSUV', 'Gran Polo Patriótico', {}),
    ('jorge-rodriguez', 'JR', 'Jorge Rodríguez', 'Dirigente del PSUV', 'PSUV', None, {}),
    ('capriles', 'HC', 'Henrique Capriles', 'Dirigente opositor', 'Unión y Cambio', None, {}),
    ('gonzalez-urrutia', 'EG', 'Edmundo González Urrutia', 'Dirigente opositor', 'PUD', None, {}),
    ('rosales', 'MR', 'Manuel Rosales', 'Dirigente de Un Nuevo Tiempo', 'UNT', None, {}),
    ('guanipa', 'JG', 'Juan Pablo Guanipa', 'Dirigente opositor', 'Primero Justicia', None, {}),
    ('ecarri', 'AE', 'Antonio Ecarri', 'Dirigente político', 'Alianza Lápiz', None, {}),
    ('caldera', 'LC', 'Luis Caldera', 'Dirigente regional', 'PSUV', None, {}),
    ('duque', 'GD', 'Gustavo Duque', 'Dirigente municipal', 'Fuerza Vecinal', None, {}),
]
# Nombre corto para encabezados y columnas, como lo escribe la demo (Temas: "González U.", "D. Rodríguez").
CORTO = {'machado': 'Machado', 'delcy-rodriguez': 'D. Rodríguez', 'jorge-rodriguez': 'J. Rodríguez', 'capriles': 'Capriles',
         'gonzalez-urrutia': 'González U.', 'rosales': 'Rosales', 'guanipa': 'Guanipa', 'ecarri': 'Ecarri', 'caldera': 'Caldera', 'duque': 'Duque'}
for fid, ini, nombre, cargo, partido, coal, extra in FIGS:
    f = {'id': fid, 'org_id': 'brujula', 'iniciales': ini, 'nombre': nombre, 'nombre_corto': CORTO[fid], 'cargo': cargo, 'partido': partido}
    if coal: f['coalicion'] = coal
    if extra: f['extra'] = extra
    add('figuras', f)

CF = [
    ('pres-machado', 'presidenciales', 'machado', 'Propia', 1, {'candidatura': True}),
    ('pres-delcy-rodriguez', 'presidenciales', 'delcy-rodriguez', 'Rival', 2, {'candidatura': True}),
    ('pres-jorge-rodriguez', 'presidenciales', 'jorge-rodriguez', 'Rival', 3, {}),
    ('pres-capriles', 'presidenciales', 'capriles', 'Rival', 4, {'candidatura': True}),
    ('pres-gonzalez-urrutia', 'presidenciales', 'gonzalez-urrutia', 'Aliada', 5, {}),
    ('pres-rosales', 'presidenciales', 'rosales', 'A observar', 6, {}),
    ('pres-guanipa', 'presidenciales', 'guanipa', 'Aliada', 7, {}),
    ('pres-ecarri', 'presidenciales', 'ecarri', 'A observar', 8, {}),
    ('zulia-rosales', 'zulia', 'rosales', 'Propia', 1, {}),
    ('zulia-caldera', 'zulia', 'caldera', 'Rival', 2, {}),
    ('zulia-guanipa', 'zulia', 'guanipa', 'Aliada', 3, {'cargo': 'Dirigente regional'}),
    ('chacao-duque', 'chacao', 'duque', 'Propia', 1, {}),
]
for i, c, f, rel, o, ex in CF:
    r = {'id': i, 'campana_id': c, 'figura_id': f, 'relacion': rel, 'orden': o}
    if ex: r['extra'] = ex
    add('campana_figuras', r)

MET = [  # campaña, figura, menciones, part, fav, neu, desf, neto, alcance, interaccion, riesgo, nivel
    ('presidenciales', 'machado', 62000, 31.0, 38, 41, 21, 17, 4800000, 4.6, 42, 'Medio'),
    ('presidenciales', 'delcy-rodriguez', 54000, 27.0, 29, 40, 31, -2, 4100000, 3.1, 55, 'Medio'),
    ('presidenciales', 'jorge-rodriguez', 24000, 12.0, 18, 39, 43, -25, 2200000, 1.4, 78, 'Alto'),
    ('presidenciales', 'capriles', 22000, 11.0, 33, 49, 18, 15, 1600000, 5.2, 18, 'Bajo'),
    ('presidenciales', 'gonzalez-urrutia', 12000, 6.0, 34, 48, 18, 16, 900000, 3.8, 24, 'Bajo'),
    ('presidenciales', 'rosales', 11000, 5.5, 41, 44, 15, 26, 1300000, 6.1, 12, 'Bajo'),
    ('presidenciales', 'guanipa', 9000, 4.5, 27, 51, 22, 5, 700000, 2.2, 47, 'Medio'),
    ('presidenciales', 'ecarri', 6000, 3.0, 24, 58, 18, 6, 400000, 1.9, 29, 'Bajo'),
    ('zulia', 'rosales', 10560, 44.0, 34, 41, 25, 9, None, None, 31, 'Bajo'),
    ('zulia', 'caldera', 8800, 36.7, 24, 46, 30, -6, None, None, 38, 'Medio'),
    ('zulia', 'guanipa', 4640, 19.3, 30, 44, 26, 4, None, None, 47, 'Medio'),
    ('chacao', 'duque', 5200, 52.0, 39, 43, 18, 21, None, None, 15, 'Bajo'),
]
PRE = {'presidenciales': 'pres', 'zulia': 'zulia', 'chacao': 'chacao'}
for c, f, m, p, fa, ne, de, nt, al, it, ri, nv in MET:
    r = {'id': f'{PRE[c]}-{f}-30d', 'campana_id': c, 'figura_id': f, 'periodo': '30d', 'menciones': m, 'participacion': p,
         'favorable': fa, 'neutral': ne, 'desfavorable': de, 'neto': nt, 'riesgo': ri, 'riesgo_nivel': nv}
    if al is not None: r['alcance'] = al
    if it is not None: r['interaccion'] = it
    if c == 'presidenciales' and f == 'machado':
        r['seguidores'] = 6400000
        r['notas_medios'] = 200
        r['detalle'] = {
            'canales': [{'canal': k, 'menciones': v} for k, v in [('X', 21700), ('Facebook', 13640), ('Instagram', 8060), ('Medio digital', 7440),
                                                                  ('TikTok', 6200), ('Radio', 2480), ('Televisión', 1860), ('YouTube', 620)]],
            'cobertura': {'favorables': 74, 'neutrales': 88, 'desfavorables': 38,
                          'por_medio': [{'medio': k, 'notas': v} for k, v in [(MD, 52), (PN, 46), (DN, 38),
                                                                             (ER, 31), (TV, 27), (MR, 6)]]}}
    add('figura_metricas', r)

# ====================================================================
# Temas (presidenciales): series de la demo (Temas.dc.html)
# ====================================================================
def tot(i):
    return 1 + .01 * i + {11: 1.6, 12: .9, 27: 1.3, 28: .9, 29: .8}.get(i, 0)
GC = [('X', 38), ('Facebook', 22), ('TikTok', 14), ('Instagram', 10), ('Medios', 9), ('YouTube', 7)]
TM = [
    ('eco', 'pres-economia', 'Economía y salarios', 52000, 26, 4, lambda i: 1.4 if i in (11, 12) else 1, (34, 46, 20), False),
    ('mig', 'pres-migracion', 'Migración y retorno', 38000, 19, 11, lambda i: 1.5 if i >= 26 else .95, (52, 36, 12), True),
    ('fec', 'pres-fecha-electoral', 'Fecha electoral', 34000, 17, 18, lambda i: 1 + (i - 20) * .1 if i >= 20 else .8, (22, 40, 38), False),
    ('ser', 'pres-servicios', 'Servicios públicos', 26000, 13, -3, lambda i: 1 - i * .004, (36, 46, 18), False),
    ('sal', 'pres-salud', 'Salud', 22000, 11, 0, lambda i: 1, (38, 47, 15), False),
    ('seg', 'pres-seguridad', 'Seguridad', 12000, 6, -6, lambda i: 1.1 - i * .006, (30, 48, 22), False),
    ('otr', 'pres-otros', 'Otros', 16000, 8, None, lambda i: 1, (48, 38, 14), False),
]
TID = {t[0]: t[1] for t in TM}
for o, (k, tid, nombre, m, pc, ch, fn, bal, propio) in enumerate(TM, 1):
    det = {'canales': [{'canal': c, 'porcentaje': v} for c, v in GC]}
    if k == 'otr': det['otros'] = True
    add('temas', {'id': tid, 'campana_id': 'presidenciales', 'nombre': nombre, 'menciones': m, 'porcentaje': pc, 'cambio': ch,
                  'es_propio': propio, 'orden': o, 'detalle': det})
    serie = reparto([tot(i) * fn(i) for i in range(30)], m)
    for i, v in enumerate(serie):
        add('series_diarias', {'id': f'{tid}-{DIAS[i]}', 'campana_id': 'presidenciales', 'entidad': 'tema', 'entidad_id': tid,
                               'fecha': str(DIAS[i]), 'menciones': v})

# Mapa tema × figura
FO = ['machado', 'gonzalez-urrutia', 'guanipa', 'delcy-rodriguez', 'jorge-rodriguez', 'capriles', 'rosales', 'ecarri']
FNETO = [17, 16, 5, -2, -25, 15, 26, 6]
FTOT = {'machado': 62000, 'gonzalez-urrutia': 12000, 'guanipa': 9000, 'delcy-rodriguez': 54000, 'jorge-rodriguez': 24000,
        'capriles': 22000, 'rosales': 11000, 'ecarri': 6000}
HT = [[26, 5, 4, 31, 10, 14, 6, 4], [41, 8, 5, 22, 8, 9, 4, 3], [36, 8, 6, 20, 17, 7, 4, 2], [26, 4, 4, 30, 11, 12, 9, 4], [20, 5, 4, 36, 13, 12, 6, 4], [26, 4, 5, 28, 16, 12, 6, 3]]
HP = [[18, 16, 20, 30, 14, 32, 22, 24], [34, 22, 14, 16, 6, 10, 6, 4], [24, 30, 28, 8, 34, 12, 10, 8], [8, 8, 12, 20, 10, 22, 34, 14], [5, 9, 6, 14, 6, 10, 10, 12], [4, 5, 10, 6, 18, 6, 8, 6]]
OFF = [-4, 14, -16, 2, 4, -3]
usado = {f: sum(round(TM[t][3] * HT[t][fi] / 100) for t in range(6)) for fi, f in enumerate(FO)}
# Otros: la figura propia recibe exactamente lo que le falta para su total (sus 7 temas suman 62,000); el resto de las
# 16,000 se reparte entre las demás según lo que les falta (Ecarri ya lo supera con los 6 temas: 0).
OTROS = {'machado': FTOT['machado'] - usado['machado']}
_resto = [f for f in FO if f != 'machado']
OTROS.update(zip(_resto, reparto([max(FTOT[f] - usado[f], 0) for f in _resto], TM[6][3] - OTROS['machado'])))
for ti in range(7):
    k, tid, nombre, m = TM[ti][0], TM[ti][1], TM[ti][2], TM[ti][3]
    for fi, f in enumerate(FO):
        if ti < 6:
            men = round(m * HT[ti][fi] / 100)
            r = {'id': f'{tid}-{f}', 'campana_id': 'presidenciales', 'tema_id': tid, 'figura_id': f, 'menciones': men,
                 'porcentaje': HT[ti][fi], 'porcentaje_propias': HP[ti][fi],
                 'neto': FNETO[fi] + jround(OFF[ti] * (0.4 if fi else 1))}
        else:
            men = OTROS[f]
            r = {'id': f'{tid}-{f}', 'campana_id': 'presidenciales', 'tema_id': tid, 'figura_id': f, 'menciones': men,
                 'porcentaje': round(men / m * 100, 1), 'porcentaje_propias': 100 - sum(HP[j][fi] for j in range(6))}
        if f == 'machado':
            fa, ne, de = TM[ti][7]
            r.update({'favorable': fa, 'neutral': ne, 'desfavorable': de, 'neto': fa - de})
        if tid == 'pres-migracion' and f == 'delcy-rodriguez':
            r.update({'porcentaje_hace_7d': 16, 'porcentaje_propias_hace_7d': 5})
        add('tema_figuras', r)
assert sum(r['menciones'] for r in T['tema_figuras'] if r['tema_id'] == 'pres-otros') == 16000
assert sum(r['menciones'] for r in T['tema_figuras'] if r['figura_id'] == 'machado') == 62000

# Temas zulia / chacao
for c, lista in [('zulia', [('zulia-electricidad', 'Servicio eléctrico', 7440, 31, 38, 'En aumento', {'cambio_ventana': '48 h'}, False),
                            ('zulia-agua', 'Agua', 4560, 19, None, 'Estable', {}, False),
                            ('zulia-combustible', 'Combustible', 3840, 16, None, 'Estable', {}, False),
                            ('zulia-empleo-petrolero', 'Empleo petrolero', 3360, 14, None, 'En aumento', {}, True),
                            ('zulia-seguridad', 'Seguridad', 2640, 11, None, 'A la baja', {}, False),
                            ('zulia-otros', 'Otros', 2160, 9, None, 'Estable', {'otros': True}, False)]),
                 ('chacao', [('chacao-movilidad', 'Movilidad', 2800, 28, None, 'En aumento', {}, False),
                             ('chacao-seguridad', 'Seguridad', 2200, 22, None, 'Estable', {}, False),
                             ('chacao-espacios-publicos', 'Espacios públicos', 1900, 19, None, 'Estable', {}, False),
                             ('chacao-recoleccion', 'Recolección', 1300, 13, None, 'A la baja', {}, False),
                             ('chacao-comercio', 'Comercio', 1000, 10, None, 'Estable', {}, False),
                             ('chacao-otros', 'Otros', 800, 8, None, 'Estable', {'otros': True}, False)])]:
    for o, (tid, nombre, m, pc, ch, tr, det, propio) in enumerate(lista, 1):
        r = {'id': tid, 'campana_id': c, 'nombre': nombre, 'menciones': m, 'porcentaje': pc, 'tendencia': tr, 'es_propio': propio, 'orden': o}
        if ch is not None: r['cambio'] = ch
        if det: r['detalle'] = det
        add('temas', r)

# ====================================================================
# Narrativas (presidenciales, Temas.dc.html)
# ====================================================================
CH = ['X', 'Facebook', 'TikTok', 'Instagram', 'Medios', 'YouTube']
DIR = {'f': 'Favorable', 'u': 'Desfavorable', 'n': 'Sin dirección', 'p': 'Posicionamiento'}
TRN = {'em': 'Emergente', 'up': 'En aumento', 'st': 'Estable', 'dn': 'A la baja'}
NID = {'qvc': 'pres-que-vuelvan-a-casa', 'fd': 'pres-fuera-del-dialogo', 'pp': 'pres-primera-presidenta', 'ld': 'pres-linea-dura',
       've': 'pres-voto-exterior', 'sb': 'pres-salario-bolivares', 'fc': 'pres-fecha-cierta', 'ce': 'pres-continuidad',
       'pe': 'pres-participar', 'dcr': 'pres-dialogo-resultados', 'ug': 'pres-unidad'}
# Las etiquetas de narrativa son temas neutros: no describen ni valoran a la persona, ni le atribuyen una postura.
POS = ' La etiqueta es neutral: resume el tema de las menciones, sin valorarlo ni atribuir una postura a la figura.'
# Campos de la serie diaria:
#   m24 = menciones del último día (= menciones_24h); d28 = el día anterior (si falta, sale de cambio_24h).
#   c7 = cambio de los últimos 7 días contra los 7 anteriores. Si la narrativa tiene c7, la serie se ajusta para dar ese valor;
#   con c7d=1 el cambio se deriva de la serie (narrativa demasiado nueva para ajustarlo); las emergentes (c7=None) derivan
#   veces_promedio = último día / promedio de los 7 días anteriores.
#   k = forma de la serie desde detectada_el (antes es 0).
NR = [
    dict(id='qvc', n='Que vuelvan a casa', fig=0, dir='f', t='mig', m=14300, m24=640, c24=6, c7=18, tr='up', first='2027-04-16',
         k=lambda i: .7 + (.22 if i >= 26 else 0) + (.5 if i == 11 else 0),
         s='El plan de retorno de migrantes como promesa central de la campaña.',
         res='Agrupa las menciones que asocian a la figura con el regreso de los venezolanos en el exterior y con su plan de retorno. Creció con la gira por los Andes, que empezó el 10 de mayo. Es la narrativa favorable más grande del periodo.',
         ok=1, reach=3400000, acc=9800, net=58, ch=[34, 22, 19, 13, 8, 4], push=[(0, 9), (1, 5), (ER, 3), (PN, 2)],
         pt='el plan de retorno de migrantes', med=[PN, ER], terms=['#QueVuelvanACasa', 'plan de retorno', 'gira por los Andes', 'reencuentro'],
         rel=[('ve', 0), ('pp', 0)]),
    dict(id='fd', n='Diálogo y fecha electoral', fig=0, dir='u', t='fec', m=9600, m24=2010, d28=1240, c24=62, c7d=1, tr='up', first='2027-05-04',
         k=lambda i: 4 + (i - 20),
         s='Menciones que vinculan la exigencia de fecha electoral con la mesa de diálogo.',
         res='Agrupa las menciones que vinculan la exigencia de una fecha electoral con la mesa de diálogo. Apareció el 4 de mayo y creció tras la cuarta ronda del diálogo y la conferencia de prensa del 11 de mayo. Creció 62% en las últimas 24 horas.',
         reach=2600000, acc=5900, net=-64, ch=[41, 24, 15, 9, 7, 4], push=[(SIN_AFILIACION, 21), (MD, 5), (PN, 3)],
         pt='la cuarta ronda del diálogo', med=[MD, TVN],
         coord={'nivel': 'Medio', 'senales': ['Posibles textos idénticos: 312 publicaciones en X con la misma redacción.',
                                              'Posible ráfaga: 44% de esas publicaciones salió entre las 20:00 y las 21:00 del 11 de mayo.']},
         terms=['mesa de diálogo', 'cuarta ronda', 'fecha electoral', 'acuerdos'], rel=[('fc', 1), ('ld', 0), ('dcr', 0)], fol=1),
    dict(id='pp', n='Primera presidenta', fig=0, dir='f', t='otr', m=8100, m24=270, c24=1, c7=3, tr='st', first='2027-04-16',
         k=lambda i: 1 + (2 if i == 11 else .8 if i == 12 else 0),
         s='La posibilidad de que Venezuela elija a su primera mujer presidenta.',
         res='Agrupa las menciones que presentan la candidatura como la posibilidad de elegir a la primera presidenta del país. Tuvo su mayor volumen en el primer debate, el 25 de abril, y se mantiene estable desde entonces.',
         ok=1, reach=2100000, acc=6400, net=71, ch=[22, 18, 31, 21, 5, 3], push=[(0, 6), (2, 3), (DN, 2)],
         pt='la candidatura y el primer debate', med=[DN, TV], terms=['#PrimeraPresidenta', 'primera mujer', 'debate presidencial'],
         rel=[('qvc', 0)]),
    dict(id='ld', n='Negociación y acuerdos', fig=0, dir='u', t='fec', m=4200, m24=80, c24=-4, c7=-22, tr='dn', first='2027-04-15',
         k=lambda i: 1.7 - i * .045 + (1.5 if i == 11 else 0),
         s='Menciones sobre la disposición a negociar y los acuerdos políticos.',
         res='Agrupa las menciones sobre negociación y acuerdos políticos asociadas a la figura. Viene a la baja desde el primer debate. Parte de su conversación se trasladó a "Diálogo y fecha electoral".',
         ok=1, reach=900000, acc=2700, net=-52, ch=[46, 27, 8, 6, 9, 4], push=[(SIN_AFILIACION, 12)], pt='negociación y acuerdos políticos',
         med=[DD, ER], terms=['negociación', 'acuerdos políticos', 'disposición a negociar'], rel=[('fd', 0), ('pe', 0)]),
    dict(id='ve', n='Voto en el exterior', fig=0, dir='f', t='mig', m=3900, m24=2100, c24=210, c7=None, tr='em', first='2027-05-09',
         k=lambda i: 1 + .5 * (i - 25),
         s='El derecho a votar de los venezolanos que viven fuera del país.',
         res='Agrupa las menciones sobre el registro y el voto de los venezolanos en el exterior, asociadas a la propuesta de la figura. Se detectó el 9 de mayo, un día antes de la gira, y hoy tiene {x} veces su promedio de 7 días.',
         reach=800000, acc=2900, net=49, ch=[37, 16, 24, 15, 5, 3], push=[(0, 7), (1, 4), (MD, 3)], pt='voto en el exterior',
         med=[MD, ER], terms=['#VotoEnElExterior', 'registro electoral', 'consulados'], rel=[('qvc', 0), ('fc', 0)]),
    dict(id='sb', n='Salario en bolívares', fig=-1, dir='n', t='eco', m=3100, m24=1700, c24=140, c7=None, tr='em', first='2027-05-08',
         k=lambda i: 1 + .4 * (i - 24),
         s='El debate sobre el valor y el ajuste de los salarios en bolívares.',
         res='Agrupa las menciones sobre el valor del salario en bolívares y las propuestas de ajuste. No está asociada a una sola figura: aparece en la conversación del tema Economía y salarios. Se detectó el 8 de mayo.',
         reach=700000, acc=2500, net=None, ch=[29, 31, 17, 8, 11, 4], push=[(5, 4), (3, 4), (ER, 3)], pt='salario en bolívares',
         med=[DN, ER], terms=['salario mínimo', 'bolívares', 'ajuste salarial'], rel=[('ce', 0)]),
    dict(id='fc', n='Fecha cierta', fig=-2, dir='n', t='fec', m=2600, m24=1400, c24=120, c7=None, tr='em', first='2027-05-10',
         k=lambda i: 1 + .35 * (i - 26),
         s='La exigencia de una fecha electoral definida y sin cambios.',
         res='Agrupa las menciones que piden confirmar la fecha de la elección sin nuevos cambios. Toca a varias figuras, entre ellas la propia, y funciona como respuesta a "Diálogo y fecha electoral". Se detectó el 10 de mayo.',
         reach=600000, acc=2100, net=None, ch=[44, 19, 14, 10, 9, 4], push=[(0, 8), (1, 6), (2, 5), (MR, 2)], pt='la fecha de la elección',
         med=[MR, ER], terms=['#FechaCierta', 'cronograma electoral', 'jornada electoral'], rel=[('fd', 1), ('ve', 0)]),
    dict(id='ce', n='Continuidad y estabilidad', fig=3, dir='p', t='eco', m=5400, m24=190, c24=2, c7=-1, tr='st', first='2027-04-14',
         k=lambda i: 1 + (.8 if i == 11 else 0), s='Menciones sobre continuidad y estabilidad asociadas a la figura.',
         reach=1300000, acc=3600, net=12, ch=[30, 28, 12, 9, 17, 4], push=[(3, 14), (4, 6), (TVN, 4)], pt='continuidad y estabilidad',
         med=[TVN, TV], terms=['continuidad', 'estabilidad', 'gestión'], rel=[('sb', 0)]),
    dict(id='pe', n='Participar en las elecciones', fig=5, dir='p', t='fec', m=3200, m24=170, c24=9, c7=24, tr='up', first='2027-04-18',
         k=lambda i: .6 + i * .03 + (.8 if i == 11 else 0), s='Menciones sobre la participación en la elección asociadas a la figura.',
         reach=800000, acc=2300, net=21, ch=[39, 25, 11, 9, 12, 4], push=[(5, 13), (DN, 3)], pt='la participación en la elección',
         med=[DN, ER], terms=['participación', 'voto', 'ruta electoral'], rel=[('ld', 0), ('fc', 0)]),
    dict(id='dcr', n='Diálogo con resultados', fig=4, dir='p', t='fec', m=2300, m24=None, c24=12, c7=None, tr='up', first='2027-05-02',
         k=lambda i: 1 + (i - 18) * .1, s='Menciones sobre la mesa de diálogo y sus acuerdos asociadas a la figura.',
         reach=700000, acc=1800, net=4, ch=[36, 24, 10, 7, 19, 4], push=[(4, 15), (3, 7), (TVN, 4)], pt='la mesa de diálogo y sus acuerdos',
         med=[TVN, TV], terms=['mesa de diálogo', 'acuerdos', 'cuarta ronda'], rel=[('fd', 0), ('fc', 1)]),
    dict(id='ug', n='Unidad para ganar', fig=1, dir='p', t='otr', m=1700, m24=None, c24=0, c7=None, tr='st', first='2027-04-20',
         k=lambda i: 1, s='Menciones sobre la unidad de la oposición asociadas a la figura.',
         reach=400000, acc=1300, net=33, ch=[35, 26, 14, 13, 8, 4], push=[(1, 11), (2, 6), (DD, 2)], pt='la unidad de la oposición',
         med=[DD, ER], terms=['unidad', 'candidatura unitaria'], rel=[('pp', 0)]),
]

def pct(a, b):
    return jround((a / b - 1) * 100)

def serie_narrativa(n):
    """Serie de 30 días que suma n['m'], termina en m24 y reproduce cambio_24h y cambio_7d guardados."""
    f0 = DIAS.index(date.fromisoformat(n['first']))
    if n.get('m24') is None:
        # m24 libre: el penúltimo día sigue la forma k y el último aplica cambio_24h.
        wl = [n['k'](i) if i >= f0 else 0 for i in range(30)]
        d28 = jround(n['m'] * wl[28] / sum(wl))
        n['m24'] = jround(d28 * (1 + n['c24'] / 100))
        n['c7d'] = 1
    d29 = n['m24']
    d28 = n.get('d28') or jround(d29 / (1 + n['c24'] / 100))
    w = [n['k'](i) if i >= f0 else 0 for i in range(28)]
    resto = n['m'] - d28 - d29
    if n.get('c7') is None or n.get('c7d'):
        s = reparto(w, resto) + [d28, d29]
    else:
        # A = días 0-15, B = 16-22 (7 días previos), C = 23-27; A y B con la misma escala, C libre para dar cambio_7d.
        KA, KB = sum(w[:16]), sum(w[16:23])
        b = n['m'] / (KA + KB * (2 + n['c7'] / 100))
        P = jround(b * KB)
        S = jround(P * (1 + n['c7'] / 100))
        s = reparto(w[:16], n['m'] - P - S) + reparto(w[16:23], P) + reparto(w[23:28], S - d28 - d29) + [d28, d29]
    assert len(s) == 30 and sum(s) == n['m'] and min(s) >= 0, (n['id'], s)
    assert all(v == 0 for v in s[:f0]) and s[f0] > 0, (n['id'], 'detectada_el')
    assert pct(s[29], s[28]) == n['c24'], (n['id'], s[28], s[29])
    emergente = n['tr'] == 'em'
    c7 = pct(sum(s[23:]), sum(s[16:23])) if sum(s[16:23]) and not emergente else None
    if n.get('c7') is not None and not n.get('c7d'):
        assert c7 == n['c7'], (n['id'], c7)
    x = round(s[29] / (sum(s[22:29]) / 7), 1) if emergente else None
    return s, c7, x

NARR = {}  # id corto -> fila guardada (para los reportes)
for o, n in enumerate(NR, 1):
    nid = NID[n['id']]
    serie, c7, x = serie_narrativa(n)
    order = sorted(range(6), key=lambda j: -n['ch'][j])  # estable, como Array.sort de la demo
    if n['dir'] == 'u' or n['fig'] == -1:
        primera = (CH[order[0]], 'Cuenta pública', 'Publicación ciudadana de ejemplo sobre ', 24)
    else:
        primera = (CH[order[0]], 'Cuenta oficial de una figura en seguimiento', 'Publicación de ejemplo sobre ', 24)
    pts = [primera, ('Medio digital', n['med'][0], 'Nota de ejemplo sobre ', 17),
           (CH[order[1]], 'Cuenta pública', 'Publicación ciudadana de ejemplo sobre ', 12),
           ('Radio' if n['med'][1] == ER else 'Televisión', n['med'][1], 'Segmento de ejemplo sobre ', 8),
           (CH[order[2]], 'Cuenta pública', 'Video o publicación de ejemplo sobre ', 5)]
    # En las narrativas en contra solo impulsan medios genéricos o cuentas sin afiliación, nunca una figura.
    assert n['dir'] != 'u' or all(isinstance(p, str) for p, v in n['push']), n['id']
    det = {
        'canales': [{'canal': CH[j], 'porcentaje': n['ch'][j]} for j in range(6)],
        'impulsores': [({'figura_id': FO[p]} if isinstance(p, int) else {'medio': p}) | {'porcentaje': v} for p, v in n['push']],
        'publicaciones': [{'canal': c, 'fuente': w, 'descripcion': d + n['pt'], 'alcance': jround(n['m'] * f / 1000) * 1000} for c, w, d, f in pts],
        'terminos': n['terms'],
        'relacionadas': [{'narrativa_id': NID[r], 'tipo': 'Contranarrativa' if c else 'Relacionada'} for r, c in n['rel']],
    }
    if 'coord' in n: det['coordinacion'] = n['coord']
    if n['fig'] == -2: det['figura_ids'] = [FO[p] for p, v in n['push'] if isinstance(p, int)]
    xs = f'{x:.1f}' if x is not None else None
    res = (n.get('res') or (n['s'] + POS)).replace('{x}', xs or '')
    r = {'id': nid, 'campana_id': 'presidenciales', 'figura_id': FO[n['fig']] if n['fig'] >= 0 else None, 'tema_id': TID[n['t']],
         'nombre': n['n'], 'direccion': DIR[n['dir']], 'menciones': n['m'], 'menciones_24h': n['m24'], 'cambio_24h': n['c24'],
         'cambio_7d': c7, 'tendencia': TRN[n['tr']], 'detectada_el': n['first'], 'veces_promedio': x,
         'alcance': n['reach'], 'cuentas_unicas': n['acc'], 'neto': n['net'], 'estado': 'Activa', 'seguida': bool(n.get('fol')),
         'descripcion': n['s'], 'resumen': res, 'resumen_aprobado': bool(n.get('ok')), 'orden': o, 'detalle': det}
    add('narrativas', r)
    NARR[n['id']] = r | {'_serie': serie}
    for i, v in enumerate(serie):
        add('series_diarias', {'id': f'{nid}-{DIAS[i]}', 'campana_id': 'presidenciales', 'entidad': 'narrativa', 'entidad_id': nid,
                               'fecha': str(DIAS[i]), 'menciones': v})

for c, fig, lista in [('zulia', 'rosales', [('zulia-experiencia', 'Experiencia de gestión', 'Favorable', 2900, 'Estable', 'Menciones sobre su trayectoria en la gestión regional.'),
                                           ('zulia-recuperar-servicios', 'Recuperar los servicios del Zulia', 'Favorable', 2100, 'En aumento', 'Asocia su nombre con propuestas sobre electricidad y agua.'),
                                           ('zulia-mas-de-lo-mismo', 'Renovación política', 'Desfavorable', 1600, 'Estable', 'Menciones sobre renovación política en el estado.'),
                                           ('zulia-sin-plan-electrico', 'Propuestas sobre el servicio eléctrico', 'Desfavorable', 1300, 'En aumento', 'Menciones que piden propuestas concretas sobre las fallas eléctricas.')]),
                      ('chacao', 'duque', [('chacao-gestion-cercana', 'Gestión cercana al vecino', 'Favorable', 1400, 'Estable', 'Lo asocia con atención directa a las comunidades del municipio.'),
                                          ('chacao-ordenado', 'Chacao ordenado', 'Favorable', 900, 'En aumento', 'Destaca el mantenimiento de plazas, aceras y espacios públicos.'),
                                          ('chacao-trafico', 'Resultados en movilidad', 'Desfavorable', 600, 'Estable', 'Menciones sobre resultados en movilidad y estacionamiento.')])]:
    for o, (nid, nombre, d, m, tr, desc) in enumerate(lista, 1):
        add('narrativas', {'id': nid, 'campana_id': c, 'figura_id': fig, 'nombre': nombre, 'direccion': d, 'menciones': m,
                           'tendencia': tr, 'descripcion': desc, 'orden': o})

# Series de la figura propia en Zulia y Chacao, a partir del trazo SVG de la demo
def desde_svg(path, total, pico_x, pico_dia):
    pts = [tuple(map(float, p.split())) for p in path.replace('M', '').split(' L')]
    pts = [(pico_dia * 220 / 29 if abs(x - pico_x) < .01 else x, y) for x, y in pts]
    pts.sort()
    vals = []
    for i in range(30):
        x = i * 220 / 29
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            if x1 <= x <= x2:
                y = y1 + (y2 - y1) * ((x - x1) / (x2 - x1) if x2 > x1 else 0)
                break
        vals.append(56 - y)
    return reparto(vals, total)
ZP = 'M0 40 L15 41 L30 38 L45 39 L60 37 L75 38 L90 35 L105 36 L120 34 L135 35 L150 33 L158 16 L166 26 L181 31 L196 30 L204 24 L212 17 L220 13'
CP = 'M0 38 L15 39 L30 37 L45 38 L60 36 L68 28 L76 34 L90 36 L105 35 L120 36 L135 34 L143 15 L151 25 L166 32 L181 33 L196 31 L208 30 L220 28'
for c, f, path, tot_, px, pd in [('zulia', 'rosales', ZP, 10560, 158, 22), ('chacao', 'duque', CP, 5200, 143, 20)]:
    for i, v in enumerate(desde_svg(path, tot_, px, pd)):
        add('series_diarias', {'id': f'{PRE[c]}-{f}-{DIAS[i]}', 'campana_id': c, 'entidad': 'figura', 'entidad_id': f, 'fecha': str(DIAS[i]), 'menciones': v})

# Serie de Machado (núcleo del orquestador): se conserva tal cual
MACHADO = [1046, 1134, 1219, 1175, 1139, 1271, 1392, 1348, 1328, 1548, 1988, 3952, 2961, 2432, 1916, 1872, 1835, 1923, 2002, 1958, 1930, 2063, 2184, 2228, 2366, 3071, 3580, 3120, 2968, 3051]
assert sum(MACHADO) == 62000
for i, v in enumerate(MACHADO):
    add('series_diarias', {'id': f'pres-machado-{DIAS[i]}', 'campana_id': 'presidenciales', 'entidad': 'figura', 'entidad_id': 'machado',
                           'fecha': str(DIAS[i]), 'menciones': v})

# ====================================================================
# Eventos
# ====================================================================
EV = [
    dict(id='pres-gira-andes', campana_id='presidenciales', nombre='Gira "Que vuelvan a casa" por los Andes', tipo='Gira', origen='Propio', estado='En curso',
         fecha_inicio='2027-05-10', fecha_fin='2027-05-14', hora='09:00', sede='Mérida y San Cristóbal', narrativa_id='pres-que-vuelvan-a-casa',
         menciones=9700, alcance=800000, neto=19, notas_medios=17, extra={'hora_fin': '21:00'}),
    dict(id='pres-respuesta-dialogo', campana_id='presidenciales', nombre='Respuesta a la cuarta ronda del diálogo', tipo='Conferencia de prensa', es_crisis=True,
         origen='Propio', estado='En análisis', fecha_inicio='2027-05-11', fecha_fin='2027-05-11', hora='11:00', sede='Comando de campaña', ciudad='Caracas',
         nota_estado='Resultados preliminares', menciones=15300, alcance=1900000, neto=-8, notas_medios=33),
    dict(id='pres-segundo-debate', campana_id='presidenciales', nombre='Segundo debate presidencial', tipo='Debate', origen='Institucional', estado='Programado',
         fecha_inicio='2027-05-23', fecha_fin='2027-05-23', hora='17:00', sede='Teatro Baralt', ciudad='Maracaibo'),
    dict(id='pres-cierre-campana', campana_id='presidenciales', nombre='Cierre de campaña', tipo='Mitin', origen='Propio', estado='Borrador',
         fecha_inicio='2027-06-02', fecha_fin='2027-06-02', hora='17:00', sede='Avenida Bolívar', ciudad='Caracas', nota_estado='Falta la ficha'),
    dict(id='pres-primer-debate', campana_id='presidenciales', nombre='Primer debate presidencial', tipo='Debate', origen='Institucional', estado='Cerrado',
         fecha_inicio='2027-04-25', fecha_fin='2027-04-25', hora='20:00', sede='Aula Magna de la UCV', ciudad='Caracas', nota_estado='Resultados finales',
         objetivos='Ganar la conversación del debate y posicionar el plan de retorno.', narrativa_id='pres-que-vuelvan-a-casa',
         hashtags=['#DebatePresidencial', '#QueVuelvanACasa', '#HastaElFinal'], ventana_horas=72,
         menciones=46000, menciones_antes=6400, menciones_durante=18200, menciones_despues=21400, alcance=3200000, neto=23, neto_antes=14, notas_medios=64,
         veredicto='Machado ganó la conversación y mejoró 9 puntos, de +14 a +23. El mensaje de salario no aterrizó.',
         resultados={
             'pico': {'por_minuto': 410, 'en': ts('2027-04-25', '20:47'), 'contexto': 'durante el intercambio sobre la fecha electoral', 'tema_id': 'pres-fecha-electoral'},
             'otros': {'menciones': 3220, 'participacion': 7},
             'sin_mensaje': {'menciones': 9016, 'porcentaje': 49},
             'cobertura': {'digitales': 38, 'radio': 14, 'television': 12, 'favorables': 25, 'neutrales': 27, 'desfavorables': 12},
             # Ninguna reacción de rival se vincula a una narrativa en contra: null = "Sin contra-narrativa detectada".
             'reacciones': [{'figura_id': 'delcy-rodriguez', 'publicaciones': 9, 'narrativa_id': None, 'menciones': None},
                            {'figura_id': 'jorge-rodriguez', 'publicaciones': 2, 'narrativa_id': None, 'menciones': None}],
             'hashtags': [{'hashtag': '#DebatePresidencial', 'menciones': 21300, 'lado': 'Neutral'},
                          {'hashtag': '#QueVuelvanACasa', 'menciones': 7800, 'lado': 'Propio'},
                          {'hashtag': '#VenezuelaEnPaz', 'menciones': 5600, 'lado': 'Rival', 'nota': 'Hashtag de cuentas rivales'},
                          {'hashtag': '#HastaElFinal', 'menciones': 4100, 'lado': 'Propio'}],
             'publicaciones': [{'titulo': 'Clip de ejemplo de la campaña sobre el plan de retorno', 'canal': 'TikTok', 'origen': 'Propia', 'metrica': 'reproducciones', 'valor': 1100000},
                               {'titulo': 'Hilo de análisis de ejemplo sobre el debate', 'canal': 'X', 'origen': 'Tercero', 'metrica': 'interacciones', 'valor': 18400},
                               {'titulo': 'Video de ejemplo de una cuenta rival sobre el diálogo', 'canal': 'Facebook', 'origen': 'Rival', 'metrica': 'reproducciones', 'valor': 640000}]},
         extra={'estado_region': 'Distrito Capital'}),
    dict(id='pres-arranque', campana_id='presidenciales', nombre='Arranque de campaña', tipo='Mitin', origen='Propio', estado='Cerrado',
         fecha_inicio='2027-04-04', fecha_fin='2027-04-04', sede='Plaza Altamira', ciudad='Caracas', nota_estado='Resultados finales',
         menciones=28500, alcance=2400000, neto=21, notas_medios=41),
    # Programado, no Borrador: tiene fecha y sede y es el "próximo evento" de Zulia (los borradores no cuentan como próximos).
    dict(id='zulia-recorrido', campana_id='zulia', nombre='Recorrido por Maracaibo y Cabimas', tipo='Gira', origen='Propio', estado='Programado',
         fecha_inicio='2027-05-18', fecha_fin='2027-05-18', sede='Maracaibo y Cabimas', extra={'estado_region': 'Zulia'}),
    dict(id='zulia-rueda-electrico', campana_id='zulia', nombre='Rueda de prensa sobre el servicio eléctrico', tipo='Conferencia de prensa', origen='Propio',
         estado='Cerrado', fecha_inicio='2027-05-06', fecha_fin='2027-05-06', ciudad='Maracaibo', menciones=1240, neto=11, notas_medios=9,
         extra={'estado_region': 'Zulia'}),
    dict(id='zulia-encuentro-gremios', campana_id='zulia', nombre='Encuentro con gremios en Ciudad Ojeda', tipo='Encuentro ciudadano', origen='Propio',
         estado='Cerrado', fecha_inicio='2027-04-28', fecha_fin='2027-04-28', ciudad='Ciudad Ojeda', menciones=620, notas_medios=4,
         extra={'estado_region': 'Zulia'}),
    dict(id='chacao-asamblea-altamira', campana_id='chacao', nombre='Asamblea vecinal en Altamira', tipo='Encuentro ciudadano', origen='Propio',
         estado='Programado', fecha_inicio='2027-05-20', fecha_fin='2027-05-20', sede='Plaza Altamira', ciudad='Chacao'),
    dict(id='chacao-rueda-movilidad', campana_id='chacao', nombre='Rueda de prensa sobre el plan de movilidad', tipo='Conferencia de prensa', origen='Propio',
         estado='Cerrado', fecha_inicio='2027-05-04', fecha_fin='2027-05-04', ciudad='Chacao', menciones=380, neto=14, notas_medios=5),
    dict(id='chacao-jornada-espacios', campana_id='chacao', nombre='Jornada de espacios públicos en Los Palos Grandes', tipo='Encuentro ciudadano', origen='Propio',
         estado='Cerrado', fecha_inicio='2027-04-24', fecha_fin='2027-04-24', sede='Los Palos Grandes', ciudad='Chacao', menciones=210),
]
for e in EV:
    add('eventos', e)

for o, (f, rol, men, part, fa, ne, de) in enumerate([('machado', 'Protagonista', 18400, 40, 44, 35, 21),
                                                     ('delcy-rodriguez', 'Adversaria/o', 16100, 35, 27, 36, 37),
                                                     ('capriles', 'Adversaria/o', 8280, 18, 36, 46, 18)], 1):
    add('evento_participantes', {'id': f'pres-primer-debate-{f}', 'campana_id': 'presidenciales', 'evento_id': 'pres-primer-debate', 'figura_id': f,
                                 'rol': rol, 'menciones': men, 'participacion': part, 'favorable': fa, 'neutral': ne, 'desfavorable': de,
                                 'neto': fa - de, 'orden': o})
for o, (txt, terms, men, pc, est) in enumerate([
        ('Plan de retorno de migrantes', ['plan de retorno', 'vuelvan a casa', '#QueVuelvanACasa'], 5520, 30, 'Aterrizó'),
        ('Fecha electoral en 2027', ['fecha electoral', 'cronograma', 'elecciones 2027'], 2760, 15, 'Parcial'),
        ('Recuperar el salario', ['salario digno', 'recuperar el salario'], 1104, 6, 'No aterrizó')], 1):
    add('evento_mensajes', {'id': f'pres-primer-debate-m{o}', 'campana_id': 'presidenciales', 'evento_id': 'pres-primer-debate', 'texto': txt,
                            'terminos': terms, 'menciones': men, 'porcentaje': pc, 'estado': est, 'orden': o})

# ====================================================================
# Menciones
# ====================================================================
M = [  # id, campaña, fuente, fuente_tipo, canal, instante, título, sentimiento, importancia, tema, narrativa, evento, revisada, resumen, figura, otras figuras
    # Fuentes genéricas y títulos descriptivos "de ejemplo": ningún medio real ni hechos atribuidos a personas reales.
    ('pres-mencion-1', 'presidenciales', MD, 'Medio', 'Medio digital', ts('2027-05-13', '09:10'),
     'Nota de ejemplo sobre la cuarta ronda del diálogo y la fecha electoral', 'Desfavorable', 'alto', 'pres-fecha-electoral',
     'pres-fuera-del-dialogo', 'pres-respuesta-dialogo', False, 'Nota de ejemplo sobre la cuarta ronda del diálogo y la conferencia de prensa del 11 de mayo.', 'machado', []),
    ('pres-mencion-2', 'presidenciales', 'Cuenta pública', 'Ciudadana', 'Facebook', ts('2027-05-13', '08:42'),
     'Publicación ciudadana de ejemplo, desfavorable, sobre la fecha electoral y la mesa de diálogo', 'Desfavorable', 'alto', 'pres-fecha-electoral',
     'pres-fuera-del-dialogo', None, False, 'Publicación ciudadana de ejemplo que repite la narrativa "Diálogo y fecha electoral".', 'machado', []),
    ('pres-mencion-3', 'presidenciales', 'Cuenta pública', 'Ciudadana', 'X', ts('2027-05-13', '08:05'),
     'Publicación ciudadana de ejemplo sobre la parada de la gira en San Cristóbal y el plan de retorno', 'Favorable', 'bajo', 'pres-migracion',
     'pres-que-vuelvan-a-casa', 'pres-gira-andes', True, 'Publicación ciudadana de ejemplo sobre la parada de la gira en el Táchira.', 'machado', []),
    ('pres-mencion-4', 'presidenciales', ER, 'Medio', 'Radio', ts('2027-05-12', '19:30'),
     'Segmento de radio de ejemplo sobre el plan de retorno de migrantes', 'Favorable', 'bajo', 'pres-migracion',
     'pres-que-vuelvan-a-casa', None, True, 'Segmento de radio de ejemplo que menciona a la figura aliada y el plan de retorno.', 'machado', [('gonzalez-urrutia', None)]),
    ('pres-mencion-5', 'presidenciales', PN, 'Medio', 'Medio digital', ts('2027-05-12', '17:15'),
     'Crónica de ejemplo sobre la gira por los Andes', 'Neutral', 'bajo', 'pres-migracion', None, 'pres-gira-andes', True,
     'Crónica de ejemplo sobre la gira "Que vuelvan a casa" por Mérida y San Cristóbal.', 'machado', []),
    ('pres-mencion-6', 'presidenciales', 'Cuenta pública', 'Ciudadana', 'TikTok', ts('2027-05-12', '14:20'),
     'Video ciudadano de ejemplo con fragmentos del primer debate sobre la idea de una primera presidenta', 'Favorable', 'bajo', 'pres-otros',
     'pres-primera-presidenta', None, True, 'Video ciudadano de ejemplo con fragmentos del primer debate.', 'machado', []),
    # Importancia alta: las tres pendientes de revisión son las "importantes sin revisar" de Menciones.
    ('pres-mencion-7', 'presidenciales', 'Cuenta pública', 'Ciudadana', 'X', ts('2027-05-12', '11:48'),
     'Publicación ciudadana de ejemplo, desfavorable, sobre negociación y acuerdos', 'Desfavorable', 'alto', 'pres-otros',
     'pres-linea-dura', None, False, 'Publicación ciudadana de ejemplo que repite la narrativa "Negociación y acuerdos".', 'machado', []),
    ('zulia-mencion-1', 'zulia', MR, 'Medio', 'Medio digital', ts('2027-05-13', '07:15'),
     'Nota de ejemplo sobre fallas del servicio eléctrico en Maracaibo', 'Neutral', None, 'zulia-electricidad',
     None, None, False, None, 'rosales', []),
    ('zulia-mencion-2', 'zulia', ER, 'Medio', 'Radio', ts('2027-05-13', '04:15'),
     'Segmento de radio de ejemplo sobre el suministro de agua en la Costa Oriental del Lago', 'Favorable', None, 'zulia-agua',
     None, None, False, None, 'rosales', []),
    ('zulia-mencion-3', 'zulia', 'Cuenta pública', 'Ciudadana', 'X', ts('2027-05-13', '03:15'),
     'Publicación ciudadana de ejemplo sobre las colas de combustible en el Zulia', 'Desfavorable', None, 'zulia-combustible',
     None, None, False, None, 'rosales', []),
    ('zulia-mencion-4', 'zulia', MD, 'Medio', 'Medio digital', ts('2027-05-12', '16:30'),
     'Nota de ejemplo sobre propuestas de empleo petrolero en el Zulia', 'Neutral', None, 'zulia-empleo-petrolero',
     None, None, False, None, 'caldera', []),
    ('zulia-mencion-5', 'zulia', MR, 'Medio', 'Medio digital', ts('2027-05-12', '10:20'),
     'Nota de ejemplo sobre un foro de servicios públicos en Maracaibo', 'Favorable', None, 'zulia-electricidad',
     None, None, True, None, 'guanipa', [('rosales', None)]),
    ('zulia-mencion-6', 'zulia', TV, 'Medio', 'Televisión', ts('2027-05-11', '19:00'),
     'Segmento de TV de ejemplo sobre la seguridad en Cabimas', 'Neutral', None, 'zulia-seguridad',
     None, None, True, None, 'caldera', []),
    ('chacao-mencion-1', 'chacao', PN, 'Medio', 'Medio digital', ts('2027-05-13', '06:15'),
     'Nota de ejemplo con opiniones de vecinos y comerciantes sobre la movilidad en Chacao', 'Neutral', None, 'chacao-movilidad', None, None, True, None, 'duque', []),
    ('chacao-mencion-2', 'chacao', ER, 'Medio', 'Radio', ts('2027-05-13', '02:15'),
     'Segmento de radio de ejemplo sobre la recuperación de plazas y aceras del municipio', 'Favorable', None, 'chacao-espacios-publicos',
     None, None, True, None, 'duque', []),
    ('chacao-mencion-3', 'chacao', 'Cuenta pública', 'Ciudadana', 'Instagram', ts('2027-05-12', '18:10'),
     'Publicación ciudadana de ejemplo sobre la convocatoria a la asamblea vecinal de Altamira', 'Favorable', None, 'chacao-espacios-publicos',
     None, 'chacao-asamblea-altamira', True, None, 'duque', []),
    ('chacao-mencion-4', 'chacao', 'Cuenta pública', 'Ciudadana', 'X', ts('2027-05-12', '09:40'),
     'Publicación ciudadana de ejemplo que pide mejorar los horarios de recolección en La Castellana', 'Desfavorable', None, 'chacao-recoleccion',
     None, None, True, None, 'duque', []),
    ('chacao-mencion-5', 'chacao', DN, 'Medio', 'Medio digital', ts('2027-05-11', '12:00'),
     'Nota de ejemplo sobre propuestas de comerciantes de Chacao sobre horarios y seguridad', 'Neutral', None, 'chacao-comercio', None, None, True, None, 'duque', []),
]
for (mid, c, fu, ft, ca, en, ti, se, im, te, na, ev, rev, res, fig, otras) in M:
    r = {'id': mid, 'campana_id': c, 'canal': ca, 'fuente': fu, 'fuente_tipo': ft, 'titulo': ti, 'publicada_en': en, 'figura_id': fig,
         'tema_id': te, 'narrativa_id': na, 'evento_id': ev, 'sentimiento': se, 'importancia': im, 'requiere_revision': True, 'revisada': rev,
         'estado': 'Procesada', 'origen': 'Ingesta'}
    if res: r['resumen'] = res
    # Quién la revisó: la persona de Análisis de cada campaña (en chacao, quien la administra).
    if rev: r['revisada_por'] = {'presidenciales': 'daniela', 'zulia': 'andres', 'chacao': 'lucia'}[c]
    add('menciones', r)
    add('mencion_figuras', {'id': f'{mid}-{fig}', 'campana_id': c, 'mencion_id': mid, 'figura_id': fig, 'sentimiento': se})
    for f2, s2 in otras:
        add('mencion_figuras', {'id': f'{mid}-{f2}', 'campana_id': c, 'mencion_id': mid, 'figura_id': f2, 'sentimiento': s2})

# ====================================================================
# Reglas y alertas
# ====================================================================
MEDIOS8 = [MD, PN, DN, ER, TV, MR, TVN, DD]
REG = [
    ('pres-regla-narrativa', 'Narrativa en contra crece', 'Narrativa crece', 'Alta',
     {'texto': 'Sube más de 40% en 24 h', 'umbral': 40, 'unidad': '%', 'ventana': '24 h',
      'alcance': {'relaciones': ['Propia'], 'direccion': 'Desfavorable'}, 'alcance_texto': 'Figura propia · narrativas en contra'},
     ['WhatsApp', 'En la app'], ['andrea', 'daniela', 'lucia'], True, None, 4, ts('2027-05-13', '07:12')),
    ('pres-regla-riesgo-rivales', 'Riesgo alto en rivales', 'Índice de riesgo sube', 'Alta',
     {'texto': 'Llega a 75 (Alto)', 'umbral': 75, 'unidad': 'índice', 'ventana': '24 h', 'alcance': {'relaciones': ['Rival']}, 'alcance_texto': 'Rivales'},
     ['Email', 'En la app'], ['daniela', 'lucia'], True, None, 3, ts('2027-05-13', '04:20')),
    ('pres-regla-rival-tema', 'Rival en tema propio', 'Rival publica en tema propio', 'Media',
     {'texto': '3 publicaciones en 24 h', 'umbral': 3, 'unidad': 'publicaciones', 'ventana': '24 h',
      'alcance': {'relaciones': ['Rival'], 'tema_ids': ['pres-migracion', 'pres-fecha-electoral']}, 'alcance_texto': 'Rivales · Migración y retorno, Fecha electoral'},
     ['En la app', 'Slack'], ['andrea', 'daniela', 'andres', 'lucia'], True, None, 9, ts('2027-05-13', '06:25')),
    ('pres-regla-sentimiento-aliadas', 'Sentimiento de aliadas', 'Sentimiento neto baja', 'Media',
     {'texto': 'Baja 5 puntos en 7 días', 'umbral': 5, 'unidad': 'puntos', 'ventana': '7 días', 'alcance': {'relaciones': ['Aliada']}, 'alcance_texto': 'Aliadas'},
     ['Email'], ['andres', 'lucia'], True, None, 2, ts('2027-05-12', '18:40')),
    ('pres-regla-nota-medio', 'Nota en medio destacado', 'Nota en medio destacado', 'Baja',
     {'texto': 'Alcance mayor a 100,000', 'umbral': 100000, 'unidad': 'alcance', 'ventana': 'Por nota',
      'alcance': {'relaciones': ['Propia'], 'medios': MEDIOS8}, 'alcance_texto': 'Figura propia · 8 medios'},
     ['En la app'], ['andrea', 'carla', 'lucia'], True, None, 14, ts('2027-05-12', '17:20')),
    ('pres-regla-pico', 'Pico de menciones', 'Pico de menciones', 'Según tamaño',
     {'texto': '2 veces lo habitual en 1 h', 'umbral': 2, 'unidad': 'veces lo habitual', 'ventana': '1 h', 'alcance': {}, 'alcance_texto': 'Todas las figuras'},
     ['WhatsApp', 'Email'], ['andrea', 'daniela', 'andres', 'carla', 'lucia'], True, None, 2, ts('2027-05-09', '16:00')),
    ('pres-regla-riesgo-propia', 'Riesgo de la figura propia', 'Índice de riesgo sube', 'Alta',
     {'texto': 'Llega a 50 (Medio)', 'umbral': 50, 'unidad': 'índice', 'ventana': '24 h', 'alcance': {'figura_ids': ['machado']}, 'alcance_texto': 'María Corina Machado'},
     ['WhatsApp', 'Telegram', 'En la app'], ['andrea', 'daniela', 'lucia'], True, 'machado', 0, None),
    ('pres-regla-coordinacion', 'Posible actividad coordinada', 'Posible actividad coordinada', 'Media',
     {'texto': 'Sensibilidad equilibrada', 'umbral': 'equilibrada', 'unidad': 'sensibilidad', 'ventana': '24 h',
      'alcance': {'relaciones': ['Propia']}, 'alcance_texto': 'Figura propia'},
     ['En la app'], ['daniela', 'lucia'], False, None, 1, ts('2027-05-02', '12:00')),
]
for o, (rid, nombre, tipo, sev, cond, canales, dest, activa, fig, n30, ult) in enumerate(REG, 1):
    r = {'id': rid, 'campana_id': 'presidenciales', 'nombre': nombre, 'tipo': tipo, 'severidad': sev, 'condicion': cond, 'canales': canales,
         'destinatarios': [{'persona_id': p} for p in dest], 'activa': activa, 'figura_id': fig, 'orden': o, 'disparos_30d': n30, 'ultimo_disparo': ult}
    add('reglas_alerta', r)

def ev_(fu, ca, en, de, al, se):
    return {'fuente': fu, 'canal': ca, 'publicada_en': en, 'descripcion': de, 'alcance': al, 'sentimiento': se}

AL = [
    dict(id='pres-alerta-1', regla_id='pres-regla-narrativa', severidad='Alta', estado='Nueva', tipo='Narrativa',
         texto='La narrativa "Diálogo y fecha electoral" creció 62% en 24 horas.', figura_id='machado', narrativa_id='pres-fuera-del-dialogo',
         evento_id='pres-respuesta-dialogo', detectada_en=ts('2027-05-13', '07:12'), disparos=3,
         explicacion='La regla "Narrativa en contra crece" detectó que "Diálogo y fecha electoral" pasó de unas 1,240 a unas 2,010 menciones por día: +62% en 24 horas, sobre el umbral de +40%.',
         valor='2,010 menciones (+62%)', umbral='+40% en 24 h', ventana='Últimas 24 h',
         # Ventana móvil de 24 h desde el 10 de mayo: coincide con la serie diaria de la narrativa (1,240 el 12 y 2,010 el 13).
         detalle={'grafica': {'metrica': 'Menciones de la narrativa en 24 h', 'serie': [960, 990, 1020, 1060, 1100, 1150, 1200, 1240, 1310, 1480, 1790, 2010],
                              'umbral': 1736, 'rango': [950, 1250], 'indice_disparo': 10, 'desde': ts('2027-05-10'), 'hasta': ts('2027-05-13', '09:00')},
                  'evidencia': [ev_(MD, 'Medio digital', ts('2027-05-13', '06:50'), 'Nota de ejemplo sobre la cuarta ronda del diálogo', 310000, 'Desfavorable'),
                                ev_('Cuenta pública', 'Facebook', ts('2027-05-13', '06:15'), 'Publicación ciudadana de ejemplo que repite la narrativa junto al tema fecha electoral', 84000, 'Desfavorable'),
                                ev_(TVN, 'Televisión', ts('2027-05-12', '21:00'), 'Segmento de análisis de ejemplo sobre la mesa de diálogo', 260000, 'Neutral'),
                                ev_('Cuenta pública', 'X', ts('2027-05-12', '19:40'), 'Hilo ciudadano de ejemplo sobre la mesa de diálogo', 52000, 'Desfavorable')], 'contexto': {'texto': None, 'enlace': 'evento'}, 'pasos': ['Crear evento de crisis', 'Avisar a vocería']},
         orden=1,
         log=[(None, 'Se disparó la regla "Narrativa en contra crece"', '07:12', '2027-05-13'), (None, 'Segundo y tercer disparo agrupados en esta alerta', '08:30', '2027-05-13')]),
    dict(id='pres-alerta-2', regla_id='pres-regla-riesgo-rivales', severidad='Alta', estado='En revisión', tipo='Riesgo',
         texto='El índice de riesgo de Jorge Rodríguez pasó de 71 a 78.', figura_id='jorge-rodriguez', tema_id='pres-fecha-electoral',
         detectada_en=ts('2027-05-13', '04:20'), responsable_id='daniela',
         explicacion='La regla "Riesgo alto en rivales" detectó que el índice de riesgo de Jorge Rodríguez subió de 71 a 78 en 24 horas y cruzó el nivel Alto (75).',
         valor='78 (Alto)', umbral='75 (Alto)', ventana='Últimas 24 h',
         detalle={'grafica': {'metrica': 'Índice de riesgo, 0 a 100', 'serie': [70, 71, 70, 72, 71, 71, 74, 78], 'umbral': 75, 'rango': [68, 73], 'indice_disparo': 7,
                              'desde': ts('2027-05-06'), 'hasta': ts('2027-05-13')},
                  'evidencia': [ev_(DD, 'Medio digital', ts('2027-05-12', '20:10'), 'Nota de ejemplo sobre la cuarta ronda del diálogo', 220000, 'Desfavorable'),
                                ev_('Cuenta pública', 'X', ts('2027-05-12', '22:30'), 'Publicaciones ciudadanas de ejemplo, desfavorables, sobre la fecha electoral', 96000, 'Desfavorable')],
                  'contexto': {'texto': 'El volumen desfavorable sobre la figura creció más rápido que su alcance.', 'enlace': 'figura'},
                  'pasos': ['Agregar al corte diario', 'Seguir la figura cada hora']},
         orden=2,
         log=[(None, 'Se disparó la regla "Riesgo alto en rivales"', '04:20', '2027-05-13'), ('daniela', 'tomó la alerta · En revisión', '06:05', '2027-05-13')]),
    dict(id='pres-alerta-3', regla_id='pres-regla-rival-tema', severidad='Media', estado='Nueva', tipo='Rival en tema propio',
         # Sin figura_id: la alerta no atribuye la actividad a una persona real.
         texto='Una cuenta oficial de una figura rival publicó sobre migración, tema propio de la campaña.', tema_id='pres-migracion',
         narrativa_id='pres-que-vuelvan-a-casa', detectada_en=ts('2027-05-13', '06:25'),
         explicacion='La regla "Rival en tema propio" detectó 3 publicaciones de la cuenta oficial de una figura rival sobre "Migración y retorno" en 24 horas. Es un tema propio de la campaña (19% de la conversación).',
         valor='3 publicaciones', umbral='3 en 24 h', ventana='Últimas 24 h',
         detalle={'grafica': {'metrica': 'Publicaciones de cuentas rivales sobre el tema, por día', 'serie': [0, 1, 0, 0, 1, 0, 0, 3], 'umbral': 3, 'rango': [0, 1], 'indice_disparo': 7,
                              'desde': ts('2027-05-06'), 'hasta': ts('2027-05-13')},
                  'evidencia': [ev_('Cuenta oficial', 'X', ts('2027-05-13', '06:20'), 'Publicación de ejemplo de una cuenta rival sobre programas de retorno', 180000, 'Neutral'),
                                ev_('Cuenta oficial', 'Instagram', ts('2027-05-13', '05:45'), 'Video de ejemplo de una cuenta rival sobre migración', 120000, 'Neutral')],
                  'contexto': {'texto': None, 'enlace': 'temas'}, 'pasos': ['Agregar al corte diario', 'Avisar a vocería']},
         orden=3,
         log=[(None, 'Se disparó la regla "Rival en tema propio"', '06:25', '2027-05-13')]),
    dict(id='pres-alerta-4', regla_id='pres-regla-sentimiento-aliadas', severidad='Media', estado='En revisión', tipo='Sentimiento',
         texto='El sentimiento neto de Juan Pablo Guanipa bajó 6 puntos en 7 días.', figura_id='guanipa', detectada_en=ts('2027-05-12', '18:40'), responsable_id='andres',
         explicacion='La regla "Sentimiento de aliadas" detectó que el sentimiento neto de Juan Pablo Guanipa bajó de +11 a +5 en 7 días: 6 puntos, sobre el umbral de 5.',
         valor='+5 (6 puntos menos)', umbral='Baja 5 puntos en 7 días', ventana='Últimos 7 días',
         detalle={'grafica': {'metrica': 'Sentimiento neto de la figura', 'serie': [11, 11, 10, 10, 9, 8, 7, 5], 'umbral': 6, 'rango': [9, 12], 'indice_disparo': 7,
                              'desde': ts('2027-05-05'), 'hasta': ts('2027-05-12'), 'signo': True},
                  'evidencia': [ev_(DN, 'Medio digital', ts('2027-05-12', '15:20'), 'Nota de ejemplo sobre la oposición y la mesa de diálogo', 90000, 'Neutral'),
                                ev_('Cuenta pública', 'X', ts('2027-05-12', '13:05'), 'Publicaciones ciudadanas de ejemplo, desfavorables, sobre la oposición', 48000, 'Desfavorable')],
                  'contexto': {'texto': 'Figura aliada. La baja coincide con la conversación sobre la cuarta ronda del diálogo.', 'enlace': 'figura'},
                  'pasos': ['Agregar al corte diario', 'Avisar al enlace con la figura aliada']},
         orden=4,
         log=[(None, 'Se disparó la regla "Sentimiento de aliadas"', '18:40', '2027-05-12'), ('andres', 'tomó la alerta · En revisión', '19:10', '2027-05-12')]),
    dict(id='pres-alerta-5', regla_id='pres-regla-nota-medio', severidad='Baja', estado='Pospuesta', tipo='Medios',
         texto='Nota de un portal de noticias sobre la gira por los Andes.', figura_id='machado', tema_id='pres-migracion', evento_id='pres-gira-andes',
         detectada_en=ts('2027-05-12', '17:20'), responsable_id='carla', pospuesta_hasta=ts('2027-05-14', '07:00'),
         explicacion='La regla "Nota en medio destacado" detectó una nota de un portal de noticias sobre la gira "Que vuelvan a casa" por los Andes con alcance estimado de 180,000, sobre el umbral de 100,000. Tono neutral.',
         valor='180,000 de alcance', umbral='Alcance mayor a 100,000', ventana='Por nota',
         detalle={'grafica': {'metrica': 'Alcance de notas sobre la gira, por día', 'serie': [20000, 35000, 15000, 40000, 30000, 25000, 45000, 180000], 'umbral': 100000,
                              'rango': [10000, 50000], 'indice_disparo': 7, 'desde': ts('2027-05-05'), 'hasta': ts('2027-05-12')},
                  'evidencia': [ev_(PN, 'Medio digital', ts('2027-05-12', '17:15'), 'Crónica de ejemplo sobre la gira por Mérida y San Cristóbal', 180000, 'Neutral'),
                                ev_('Cuenta pública', 'X', ts('2027-05-12', '18:05'), 'Publicaciones ciudadanas de ejemplo que comparten la nota', 36000, 'Favorable')],
                  'contexto': {'texto': None, 'enlace': 'evento'},
                  'nota_estado': 'Si el alcance sigue creciendo, conviene retomarla antes de esa hora.',
                  'pasos': ['Agregar al reporte semanal', 'Compartir con el equipo de prensa']},
         orden=5,
         log=[(None, 'Se disparó la regla "Nota en medio destacado"', '17:20', '2027-05-12'), ('carla', 'pospuso la alerta hasta el 14 may, 7:00', '17:45', '2027-05-12')]),
    dict(id='pres-alerta-6', regla_id='pres-regla-pico', severidad='Alta', estado='Resuelta', tipo='Volumen',
         texto='Pico de menciones durante el Primer debate presidencial (25 abr).', figura_id='machado', evento_id='pres-primer-debate',
         detectada_en=ts('2027-04-25', '20:10'), responsable_id='daniela', resuelta_en=ts('2027-04-26', '09:00'), disparos=4,
         motivo_cierre='Pico esperado por el debate; quedó en el reporte del evento.',
         explicacion='La regla "Pico de menciones" detectó 5,200 menciones en una hora al empezar el debate, y un máximo de 7,300: más de 2 veces lo habitual para esa hora.',
         valor='7,300 por hora', umbral='2 veces lo habitual (2,100)', ventana='Por hora',
         detalle={'grafica': {'metrica': 'Menciones por hora', 'serie': [900, 950, 1000, 980, 1100, 1400, 5200, 7300, 6100, 3200, 1800, 1200], 'umbral': 2100,
                              'rango': [800, 1300], 'indice_disparo': 6, 'desde': ts('2027-04-25', '14:00'), 'hasta': ts('2027-04-26', '01:00')},
                  'evidencia': [ev_(TV, 'Televisión', ts('2027-04-25', '20:00'), 'Transmisión de ejemplo del Primer debate presidencial', 1200000, 'Neutral'),
                                ev_('Cuenta pública', 'TikTok', ts('2027-04-25', '21:10'), 'Videos ciudadanos de ejemplo con fragmentos del debate', 310000, 'Favorable')],
                  'contexto': {'texto': None, 'enlace': 'evento'},
                  'pasos': ['Agregar al reporte del evento', 'Comparar con el evento anterior']},
         orden=6,
         log=[(None, 'Se disparó la regla "Pico de menciones"', '20:10', '2027-04-25'), ('daniela', 'tomó la alerta · En revisión', '20:14', '2027-04-25'), ('daniela', 'resolvió la alerta', '09:00', '2027-04-26')]),
    dict(id='pres-alerta-7', regla_id='pres-regla-pico', severidad='Media', estado='Descartada', tipo='Volumen',
         texto='Pico de menciones de Manuel Rosales: 2.1 veces lo habitual.', figura_id='rosales',
         detectada_en=ts('2027-05-09', '16:00'), responsable_id='andres', resuelta_en=ts('2027-05-09', '16:30'), motivo_cierre='No relevante',
         explicacion='La regla "Pico de menciones" detectó 1,260 menciones de Manuel Rosales en una hora: 2.1 veces lo habitual para esa hora.',
         valor='1,260 por hora', umbral='2 veces lo habitual (1,200)', ventana='Por hora',
         detalle={'grafica': {'metrica': 'Menciones por hora', 'serie': [520, 560, 600, 580, 640, 1260, 900, 620], 'umbral': 1200, 'rango': [450, 700], 'indice_disparo': 5,
                              'desde': ts('2027-05-09', '11:00'), 'hasta': ts('2027-05-09', '18:00')},
                  'evidencia': [ev_(TVN, 'Televisión', ts('2027-05-09', '15:30'), 'Segmento de TV de ejemplo sobre la gestión regional', 210000, 'Neutral'),
                                ev_('Cuenta pública', 'X', ts('2027-05-09', '15:50'), 'Publicaciones ciudadanas de ejemplo que comentan el segmento', 44000, 'Neutral')],
                  'contexto': {'texto': 'Figura a observar. El pico no tocó temas propios de la campaña.', 'enlace': 'figura'},
                  'pasos': ['Agregar al reporte del evento', 'Comparar con el evento anterior']},
         orden=7,
         log=[(None, 'Se disparó la regla "Pico de menciones"', '16:00', '2027-05-09'), ('andres', 'descartó la alerta · No relevante', '16:30', '2027-05-09')]),
    # Zulia
    dict(id='zulia-alerta-1', severidad='Media', estado='Nueva', tipo='Volumen', texto='La conversación sobre el servicio eléctrico en Maracaibo creció 38% en 48 horas.',
         explicacion='Tema local con más volumen del periodo.', tema_id='zulia-electricidad', detectada_en=ts('2027-05-13', '08:40'), orden=1),
    # Mismo texto que pres-alerta-4 (se agrupan en Panorama), con los valores del corte de Zulia: neto +4.
    dict(id='zulia-alerta-2', severidad='Media', estado='En revisión', tipo='Sentimiento', texto='El sentimiento neto de Juan Pablo Guanipa bajó 6 puntos en 7 días.',
         explicacion='Figura aliada, vinculada también a Presidenciales 2027. En esta campaña su neto bajó de +10 a +4 en 7 días.',
         valor='+4 (6 puntos menos)', umbral='Baja 5 puntos en 7 días', ventana='Últimos 7 días', figura_id='guanipa', detectada_en=ts('2027-05-12', '18:40'), responsable_id='andres', orden=2),
    dict(id='zulia-alerta-3', severidad='Baja', estado='Nueva', tipo='Rival en tema propio', texto='Una cuenta oficial de una figura rival publicó sobre empleo petrolero, tema propio de la campaña.',
         explicacion='Una cuenta rival entra en un tema que la campaña trabaja.', tema_id='zulia-empleo-petrolero', detectada_en=ts('2027-05-11', '10:00'), orden=3),
    dict(id='zulia-alerta-4', severidad='Baja', estado='Resuelta', tipo='Medios', texto='Nota de una emisora de radio sobre la rueda de prensa del 6 de mayo.',
         explicacion='Cobertura de un evento propio.', evento_id='zulia-rueda-electrico', figura_id='rosales', detectada_en=ts('2027-05-06', '15:00'),
         resuelta_en=ts('2027-05-06', '17:00'), orden=4),
    # Chacao
    dict(id='chacao-alerta-1', severidad='Baja', estado='Nueva', tipo='Medios', texto='Nota de un portal de noticias sobre movilidad en Chacao.',
         explicacion='Cobertura del tema con más volumen del periodo.', tema_id='chacao-movilidad', figura_id='duque', detectada_en=ts('2027-05-13', '09:15'), orden=1),
    dict(id='chacao-alerta-2', severidad='Media', estado='Resuelta', tipo='Volumen', texto='La conversación sobre recolección creció 22% en 48 horas.',
         explicacion='El volumen volvió a su nivel habitual.', tema_id='chacao-recoleccion', detectada_en=ts('2027-05-02', '10:00'), resuelta_en=ts('2027-05-03', '10:00'), orden=2),
]
def menciones_de(a):
    """Menciones sembradas que abre "Ver las N en Menciones" (mismo orden de filtro que alertas/Detalle.tsx)."""
    ms = [m for m in T['menciones'] if m['campana_id'] == a['campana_id']]
    for k in ('narrativa_id', 'evento_id', 'tema_id'):
        if a.get(k): return sum(1 for m in ms if m[k] == a[k])
    if a.get('figura_id'):
        return sum(1 for mf in T['mencion_figuras'] if mf['campana_id'] == a['campana_id'] and mf['figura_id'] == a['figura_id'])
    return None

for a in AL:
    a = dict(a)
    log = a.pop('log', [])
    a['campana_id'] = 'presidenciales' if a['id'].startswith('pres') else a['id'].split('-')[0]
    if 'detalle' in a:
        a['detalle']['menciones_relacionadas'] = menciones_de(a)
    add('alertas', a)
    # Los avisos por WhatsApp, email o Slack no se siembran: en la demo no se envió nada.
    for j, (p, txt, hora, dia) in enumerate(log, 1):
        add('alerta_actividad', {'id': f"{a['id']}-a{j}", 'campana_id': a['campana_id'], 'alerta_id': a['id'], 'persona_id': p, 'texto': txt, 'creada_en': ts(dia, hora)})

# ====================================================================
# Reportes
# ====================================================================
def it(texto, detalle=None, **o):
    r = {'texto': texto}
    if detalle: r['detalle'] = detalle
    r.update({k: v for k, v in o.items() if v is not None})
    return r

# Ritmo de "Diálogo y fecha electoral": promedio de sus últimos 7 días durante los 10 días que faltan para el segundo debate.
_fd = NARR['fd']['_serie']
VIGILAR_FD = (9600 + sum(_fd[23:]) * 10 // 7) // 1000 * 1000
SEC_DIARIO = [
    {'id': 'esencial', 'pagina': 1, 'titulo': 'Lo esencial', 'ia': True, 'nota': '3 puntos', 'puntos': [
        {'texto': 'La narrativa "Diálogo y fecha electoral" creció 62% en 24 horas y llegó a 9,600 menciones.', 'por_que': 'Es la narrativa en contra de mayor volumen. En el mismo corte el sentimiento neto bajó 1 punto y el riesgo subió 3.', 'que_hacer': 'Responder hoy con el mensaje "Fecha electoral en 2027" y medir el efecto en el corte de mañana.'},
        {'texto': '"Que vuelvan a casa" sigue en aumento: 14,300 menciones, con la gira por los Andes en su día 4.', 'por_que': 'Es la narrativa a favor más grande y sostiene el tema Migración y retorno, 19% de la conversación.', 'que_hacer': 'Mantener el ritmo de publicaciones propias en Mérida y San Cristóbal hasta el cierre de la gira.'},
        {'texto': 'La cuenta oficial de una figura rival publicó 3 veces sobre migración, tema propio de la campaña.', 'por_que': 'Migración y retorno es 19% de la conversación, y la segunda figura en participación está a 4 puntos: 27.0% frente a 31.0% de Machado.', 'que_hacer': 'Vigilar la participación por tema en Migración y retorno durante las próximas 48 horas.'}]},
    {'id': 'cifras', 'pagina': 1, 'titulo': 'Cifras del día', 'nota': 'Frente al día anterior', 'cifras': [
        {'etiqueta': 'Menciones en 24 h', 'valor': f'{MACHADO[-1]:,}', 'detalle': f'{pct(MACHADO[-1], MACHADO[-2]):+d}% · 62,000 en 30 días'}, {'etiqueta': 'Participación', 'valor': '31.0%', 'detalle': '+0.4 puntos · primer lugar'},
        {'etiqueta': 'Sentimiento neto', 'valor': '+17', 'detalle': '1 punto menos'}, {'etiqueta': 'Índice de riesgo', 'valor': '42', 'detalle': 'Medio · 3 puntos más'}]},
    {'id': 'alertas', 'pagina': 1, 'titulo': 'Alertas de las últimas 24 horas', 'nota': '5 abiertas', 'items': [
        it('La narrativa "Diálogo y fecha electoral" creció 62% en 24 horas.', chip='Alta', chip_tono='unf', valor='Abierta'),
        it('El índice de riesgo de Jorge Rodríguez pasó de 71 a 78.', chip='Alta', chip_tono='unf', valor='Abierta'),
        it('Una cuenta oficial de una figura rival publicó sobre migración, tema propio de la campaña.', chip='Media', chip_tono='warn', valor='Abierta'),
        it('El sentimiento neto de Juan Pablo Guanipa bajó 6 puntos en 7 días.', chip='Media', chip_tono='warn', valor='Abierta'),
        it('Nota de un portal de noticias sobre la gira por los Andes.', chip='Baja', chip_tono='watch', valor='Abierta')]},
    {'id': 'narr', 'pagina': 2, 'titulo': 'Narrativas en movimiento', 'nota': 'Sobre María Corina Machado', 'items': [
        it('Diálogo y fecha electoral', 'En aumento · +62% en 24 horas', chip='En contra', chip_tono='unf', valor='9,600', barra=67, tono='unf'),
        it('Que vuelvan a casa', 'En aumento', chip='A favor', chip_tono='fav', valor='14,300', barra=100, tono='fav'),
        it('Primera presidenta', 'Estable', chip='A favor', chip_tono='fav', valor='8,100', barra=57, tono='fav'),
        it('Negociación y acuerdos', 'A la baja', chip='En contra', chip_tono='unf', valor='4,200', barra=29, tono='unf')]},
    {'id': 'medios', 'pagina': 2, 'titulo': 'Medios', 'nota': '18 notas en 24 horas · 6 favorables, 9 neutrales, 3 desfavorables', 'items': [
        it(MD, enlace='Nota de ejemplo sobre la cuarta ronda del diálogo', valor='5 notas', valor2='1 favorable · 2 neutrales · 2 desfavorables'),
        it(PN, enlace='Nota de ejemplo sobre la gira por los Andes', valor='4 notas', valor2='2 favorables · 2 neutrales'),
        it(DN, enlace='Nota de ejemplo sobre las propuestas de salario', valor='3 notas', valor2='1 favorable · 1 neutral · 1 desfavorable'),
        it(ER, enlace='Segmento de ejemplo sobre el plan de retorno', valor='3 notas', valor2='1 favorable · 2 neutrales'),
        it(TV, enlace='Reporte de ejemplo sobre la agenda de campaña', valor='2 notas', valor2='1 favorable · 1 neutral'),
        it(MR, 'Sin titular destacado', valor='1 nota', valor2='1 neutral')]},
    # Por tema, sin atribuir publicaciones a personas reales. Migración (3) es la misma cifra que pres-alerta-3.
    {'id': 'rivales', 'pagina': 2, 'titulo': 'Rivales', 'nota': 'Publicaciones de cuentas oficiales rivales por tema', 'items': [
        it('Migración y retorno', 'Tema propio de la campaña', valor='3 publicaciones'),
        it('Economía y salarios', valor='2 publicaciones'),
        it('Servicios públicos', valor='2 publicaciones'),
        it('Fecha electoral', valor='2 publicaciones'),
        it('Salud', valor='1 publicación')]},
    {'id': 'agenda', 'pagina': 2, 'titulo': 'Agenda de hoy y próximos eventos', 'items': [
        it('Gira "Que vuelvan a casa" por los Andes', 'Mérida y San Cristóbal · día 4 de 5', chip='Hoy', chip_tono='live'),
        it('Segundo debate presidencial', 'Teatro Baralt, Maracaibo', valor='Dom 23 may', valor2='En 10 días'),
        it('Cierre de campaña', 'Avenida Bolívar, Caracas', valor='Mié 2 jun'),
        it('Veda electoral y jornada', 'Veda del 3 al 5 de junio · jornada el domingo 6', valor='En 24 días')]},
    {'id': 'reco', 'pagina': 2, 'titulo': 'Recomendación', 'ia': True, 'texto': 'Priorizar la respuesta a "Diálogo y fecha electoral" antes del Segundo debate presidencial del 23 de mayo y cerrar la gira con el mensaje de retorno, que es el que más crece. Revisar en el corte de mañana si el sentimiento neto vuelve a +18.'},
]
SEC_POST = [
    {'id': 'balance', 'pagina': 1, 'titulo': 'Balance', 'ia': True, 'texto': 'Machado ganó la conversación y mejoró 9 puntos, de +14 a +23. El mensaje de salario no aterrizó.'},
    {'id': 'cifras', 'pagina': 1, 'titulo': 'Cifras del evento', 'cifras': [
        {'etiqueta': 'Menciones', 'valor': '46,000', 'detalle': 'En la ventana'}, {'etiqueta': 'Alcance', 'valor': '3.2 M', 'detalle': 'Cuentas únicas estimadas'},
        {'etiqueta': 'Neto de Machado', 'valor': '+23', 'detalle': '9 puntos más'}, {'etiqueta': 'Notas en medios', 'valor': '64', 'detalle': 'Digital, radio y TV'}]},
    {'id': 'curva', 'pagina': 1, 'titulo': 'Antes, durante y después', 'nota': 'Pico de 410 menciones por minuto a las 20:47', 'items': [
        it('Antes', '72 horas previas', valor='6,400', barra=30, tono='neutro'), it('Durante', 'Transmisión del debate', valor='18,200', barra=85, tono='own'),
        it('Después', '72 horas posteriores', valor='21,400', barra=100)]},
    {'id': 'gano', 'pagina': 1, 'titulo': 'Quién ganó la conversación', 'items': [
        it('María Corina Machado', 'Neto +23', valor='40%', valor2='18,400', barra=100, tono='own'),
        it('Delcy Rodríguez', 'Neto -10', valor='35%', valor2='16,100', barra=87.5, tono='rival'),
        it('Henrique Capriles', 'Neto +18', valor='18%', valor2='8,280', barra=45, tono='rival')]},
    {'id': 'mensajes', 'pagina': 1, 'titulo': 'Mensajes clave', 'nota': 'Parte de las 18,400 menciones de Machado', 'items': [
        it('Plan de retorno de migrantes', '30% · 5,520 menciones', chip='Aterrizó', chip_tono='fav'),
        it('Fecha electoral en 2027', '15% · 2,760 menciones', chip='Parcial', chip_tono='warn'),
        it('Recuperar el salario', '6% · 1,104 menciones', chip='No aterrizó', chip_tono='unf')]},
    {'id': 'medios', 'pagina': 1, 'titulo': 'Cobertura en medios', 'nota': '64 notas', 'items': [
        it('Por tipo de medio', '38 digitales · 14 de radio · 12 de televisión'), it('Por tono', '25 favorables · 27 neutrales · 12 desfavorables')]},
    {'id': 'rivales', 'pagina': 1, 'titulo': 'Reacciones de rivales', 'items': [
        it('Delcy Rodríguez', 'Sin contra-narrativa detectada', valor='9 publicaciones'),
        it('Jorge Rodríguez', 'Sin contra-narrativa detectada', valor='2 publicaciones')]},
    {'id': 'aprend', 'pagina': 1, 'titulo': 'Aprendizajes', 'texto': 'El equipo no marcó ningún aprendizaje como publicable. Las notas internas del evento no se incluyen en este reporte.'},
]
SEC_SEMANAL = [
    {'id': 'resumen', 'pagina': 1, 'titulo': 'Resumen ejecutivo', 'ia': True, 'texto': 'Las dos narrativas más grandes crecen a la vez: "Que vuelvan a casa", a favor, y "Diálogo y fecha electoral", en contra, que es la que más rápido sube. Migración y retorno se mantiene como segundo tema de la conversación.'},
    {'id': 'narr', 'pagina': 1, 'titulo': 'Narrativas', 'nota': 'Menciones del periodo y cambio frente a la semana anterior', 'items': [
        # El cambio es cambio_7d de cada narrativa (últimos 7 días frente a los 7 anteriores, de la serie diaria).
        it('Que vuelvan a casa', f"{NARR['qvc']['cambio_7d']:+d}% · en aumento", chip='A favor', chip_tono='fav', valor='14,300', barra=100, tono='fav'),
        it('Diálogo y fecha electoral', f"{NARR['fd']['cambio_7d']:+d}% · en aumento", chip='En contra', chip_tono='unf', valor='9,600', barra=67, tono='unf'),
        it('Primera presidenta', f"{NARR['pp']['cambio_7d']:+d}% · estable", chip='A favor', chip_tono='fav', valor='8,100', barra=57, tono='fav'),
        it('Negociación y acuerdos', f"{NARR['ld']['cambio_7d']:+d}% · a la baja", chip='En contra', chip_tono='unf', valor='4,200', barra=29, tono='unf')]},
    {'id': 'temas', 'pagina': 1, 'titulo': 'Temas', 'nota': 'Parte de la conversación', 'items': [
        it('Economía y salarios', valor='26%', barra=100), it('Migración y retorno', valor='19%', barra=73), it('Fecha electoral', valor='17%', barra=65),
        it('Servicios públicos', valor='13%', barra=50), it('Salud', valor='11%', barra=42)]},
    {'id': 'part', 'pagina': 1, 'titulo': 'Participación por figura', 'items': [
        it('María Corina Machado', 'Propia', valor='31.0%', barra=100, tono='own'), it('Delcy Rodríguez', 'Rival', valor='27.0%', barra=87, tono='rival'),
        it('Jorge Rodríguez', 'Rival', valor='12.0%', barra=39, tono='rival'), it('Henrique Capriles', 'Rival', valor='11.0%', barra=35, tono='rival')]},
    {'id': 'vigilar', 'pagina': 1, 'titulo': 'Para vigilar', 'items': [
        it('"Diálogo y fecha electoral" antes del segundo debate', f"Si mantiene el ritmo de los últimos 7 días, supera las {VIGILAR_FD:,} menciones antes del 23 de mayo."),
        it('Publicaciones de cuentas rivales en Migración y retorno', 'Hubo 3 en 24 horas el 13 de mayo.'),
        it('Sentimiento neto de Juan Pablo Guanipa', 'Bajó 6 puntos en 7 días.')]},
]
CLI_OFF = {'alertas', 'rivales', 'reco'}
def secciones(lista, off=()):
    return [{'id': s['id'], 'titulo': s['titulo'], 'ia': bool(s.get('ia'))} for s in lista if s['id'] not in off]

for o, (pid, nombre, etq, desc, tipo, secs, marca, usos) in enumerate([
        ('pres-plantilla-diario', 'Corte diario', 'Base', 'Para el comando, antes de la primera reunión. Dos páginas como máximo.', 'Corte diario', secciones(SEC_DIARIO), 'Consultora', None),
        ('pres-plantilla-post', 'Reporte post-evento', 'Base', 'Resultados de un evento con su ventana de 72 horas antes y después.', 'Post-evento', secciones(SEC_POST), 'Consultora', None),
        ('pres-plantilla-semanal', 'Semanal de narrativas', 'Base', 'Qué historias crecen o se apagan, comparadas con la semana anterior.', 'Semanal de narrativas', secciones(SEC_SEMANAL), 'Consultora', None),
        ('pres-plantilla-cliente', 'Resumen para el cliente', 'Marca del cliente', 'Versión corta del corte diario con el logo del cliente, sin alertas ni rivales.', 'Corte diario', secciones(SEC_DIARIO, CLI_OFF), 'Cliente', 5)], 1):
    r = {'id': pid, 'campana_id': 'presidenciales', 'nombre': nombre, 'etiqueta': etq, 'descripcion': desc, 'tipo': tipo, 'secciones': secs, 'marca': marca, 'orden': o}
    if usos is not None: r['usos'] = usos
    add('reporte_plantillas', r)

def dest(*xs):
    FM = ['Correo con PDF', 'Enlace con acceso', 'WhatsApp resumen']
    return [({'lista': x} if x in ('comando', 'candidata', 'cliente') else {'persona_id': x}) | {'formato': FM[f]} for x, f in xs]

REP = [
    dict(id='pres-rep-diario', nombre='Corte diario', tipo='Corte diario', frecuencia='Diario', hora='07:00',
         destinatarios=dest(('comando', 0), ('candidata', 2), ('cliente', 1), ('lucia', 0)), secciones=[s | {'activa': True} for s in secciones(SEC_DIARIO)],
         formato='PDF', estado='Activo', requiere_aprobacion=False, ultimo_envio=ts('2027-05-13', '07:02'), proximo_envio=ts('2027-05-14', '07:00'),
         plantilla_id='pres-plantilla-diario', orden=1,
         extra={'descripcion': 'Todos los días a las 7:00. Cubre de 7:00 a 7:00.', 'marca': 'Consultora', 'confidencial': True,
                'seccion_analisis': 'reco', 'borrador_hora': '06:00', 'borrador_cierre': '06:30',
                'periodo_texto': 'Últimas 24 horas, de 7:00 a 7:00 · María Corina Machado frente a 3 rivales'}),
    dict(id='pres-rep-semanal', nombre='Semanal de narrativas', tipo='Semanal de narrativas', frecuencia='Semanal', hora='08:00',
         destinatarios=dest(('candidata', 0), ('cliente', 1), ('lucia', 0), ('tomas', 0)), secciones=[s | {'activa': True} for s in secciones(SEC_SEMANAL)],
         formato='PDF', estado='Activo', requiere_aprobacion=True, ultimo_envio=ts('2027-05-10', '08:01'), proximo_envio=ts('2027-05-17', '08:00'),
         plantilla_id='pres-plantilla-semanal', orden=2,
         extra={'descripcion': 'Todos los lunes a las 8:00. Compara con la semana anterior.', 'dia': 'lunes', 'marca': 'Consultora', 'confidencial': True,
                'seccion_analisis': 'resumen', 'periodo_texto': 'Semana en curso frente a la anterior · las 8 figuras de la campaña'}),
    dict(id='pres-rep-post', nombre='Post-evento automático', tipo='Post-evento', frecuencia='Por evento',
         destinatarios=dest(('comando', 0), ('candidata', 0)), secciones=[s | {'activa': True} for s in secciones(SEC_POST)],
         formato='PDF', estado='Activo', requiere_aprobacion=True, ultimo_envio=ts('2027-04-28', '21:40'), proximo_envio=ts('2027-05-26', '17:00'),
         plantilla_id='pres-plantilla-post', orden=3,
         extra={'descripcion': 'Se genera 72 horas después de cada evento propio o debate.', 'proximo_evento_id': 'pres-segundo-debate', 'marca': 'Consultora',
                'confidencial': True, 'seccion_analisis': 'balance'}),
    dict(id='pres-rep-cliente', nombre='Resumen para el cliente', tipo='Corte diario', frecuencia='Una vez',
         destinatarios=dest(('cliente', 1)), secciones=[s | {'activa': True} for s in secciones(SEC_DIARIO, CLI_OFF)],
         formato='PDF', estado='Activo', requiere_aprobacion=True, plantilla_id='pres-plantilla-cliente', orden=4,
         extra={'marca': 'Cliente', 'confidencial': True, 'seccion_analisis': 'esencial'}),
]
for r in REP:
    r['campana_id'] = 'presidenciales'
    add('reportes', r)

def doc(tipo_doc, titulo, meta, secs, marca='Consultora'):
    return {'tipo_doc': tipo_doc, 'titulo': titulo, 'meta': meta, 'marca': marca, 'secciones': copy.deepcopy(secs)}
C_DIARIO = doc('Corte diario · n.º 40', 'Corte diario del jueves 13 de mayo de 2027',
               'María Corina Machado · Presidenciales Venezuela 2027 · día 40 de 60, faltan 24 días · cubre del miércoles 12, 7:00, al jueves 13, 7:00', SEC_DIARIO)
C_POST = doc('Reporte post-evento', 'Primer debate presidencial',
             'Domingo 25 de abril de 2027 · Aula Magna de la UCV, Caracas · ventana de 72 horas antes y después · enviado el 28 de abril', SEC_POST)
C_SEM = doc('Semanal de narrativas · borrador', 'Narrativas de la semana del 10 al 16 de mayo',
            'María Corina Machado · Presidenciales Venezuela 2027 · datos al jueves 13 de mayo · se envía el lunes 17 a las 8:00', SEC_SEMANAL)
C_CLI = doc('Corte diario · n.º 40', 'Corte diario del jueves 13 de mayo de 2027',
            'María Corina Machado · Presidenciales Venezuela 2027 · día 40 de 60, faltan 24 días · cubre del miércoles 12, 7:00, al jueves 13, 7:00',
            [s for s in SEC_DIARIO if s['id'] not in CLI_OFF], marca='Cliente')
ENV = [
    # El id se conserva; el envío es la versión para el cliente del corte del 13 de mayo, igual que su contenido.
    ('pres-envio-cliente-0503', 'pres-rep-cliente', 'Resumen para el cliente · jue 13 may', ts('2027-05-12', '07:00'), ts('2027-05-13', '07:00'), ts('2027-05-13', '07:05'), None,
     'En revisión', 2, 0, {'nota': 'Espera aprobación', 'cierra_en': ts('2027-05-13', '12:00')}, C_CLI),
    ('pres-envio-diario-0513', 'pres-rep-diario', 'Corte diario · jue 13 may', ts('2027-05-12', '07:00'), ts('2027-05-13', '07:00'), ts('2027-05-13', '06:48'), ts('2027-05-13', '07:02'),
     'Entregado', 12, 12, {}, C_DIARIO),
    ('pres-envio-diario-0512', 'pres-rep-diario', 'Corte diario · mié 12 may', ts('2027-05-11', '07:00'), ts('2027-05-12', '07:00'), ts('2027-05-12', '06:47'), ts('2027-05-12', '07:01'),
     'Envío parcial', 12, 11, {'nota': 'Ejemplo: 1 destinatario sin entregar'}, None),
    ('pres-envio-diario-0511', 'pres-rep-diario', 'Corte diario · mar 11 may', ts('2027-05-10', '07:00'), ts('2027-05-11', '07:00'), ts('2027-05-11', '06:49'), ts('2027-05-11', '07:00'),
     'Entregado', 12, 12, {}, None),
    ('pres-envio-semanal-0503', 'pres-rep-semanal', 'Semanal de narrativas · 3 a 9 may', ts('2027-05-03'), '2027-05-09T23:59:59-04:00', ts('2027-05-10', '07:30'), ts('2027-05-10', '08:01'),
     'Entregado', 6, 6, {}, None),
    ('pres-envio-semanal-0426', 'pres-rep-semanal', 'Semanal de narrativas · 26 abr a 2 may', ts('2027-04-26'), '2027-05-02T23:59:59-04:00', ts('2027-05-03', '07:31'), ts('2027-05-03', '08:00'),
     'Fallido', 6, 0, {'nota': 'Ejemplo: envío fallido'}, None),
    ('pres-envio-post-primer-debate', 'pres-rep-post', 'Post-evento · Primer debate presidencial', ts('2027-04-22'), '2027-04-28T23:59:59-04:00', ts('2027-04-28', '21:10'), ts('2027-04-28', '21:40'),
     'Entregado', 9, 9, {'evento_id': 'pres-primer-debate'}, C_POST),
    ('pres-envio-post-arranque', 'pres-rep-post', 'Post-evento · Arranque de campaña', ts('2027-04-01'), '2027-04-07T23:59:59-04:00', ts('2027-04-07', '20:15'), ts('2027-04-07', '20:30'),
     'Entregado', 9, 9, {'evento_id': 'pres-arranque'}, None),
    ('pres-envio-semanal-0510', 'pres-rep-semanal', 'Semanal de narrativas · 10 a 16 may', ts('2027-05-10'), '2027-05-16T23:59:59-04:00', ts('2027-05-13', '07:00'), None,
     'Borrador', 6, 0, {'nota': 'Borrador en curso'}, C_SEM),
]
for (eid, rid, tit, pi, pf, gen, envi, est, nd, ne, ex, cont) in ENV:
    r = {'id': eid, 'campana_id': 'presidenciales', 'reporte_id': rid, 'titulo': tit, 'periodo_inicio': pi, 'periodo_fin': pf, 'generado_en': gen,
         'enviado_en': envi, 'estado': est, 'destinatarios': nd, 'entregados': ne}
    if ex: r['extra'] = ex
    if cont: r['contenido'] = cont
    add('reporte_envios', r)

# ====================================================================
# Borrador del asistente de nueva campaña (NuevaCampana.dc.html)
# ====================================================================
def ad(s, n):
    return str(date.fromisoformat(s) + timedelta(days=n))
E0 = '2027-12-05'
add('borradores', {'id': 'borrador-maracaibo', 'org_id': 'brujula', 'persona_id': 'valentina', 'tipo': 'nueva-campana',
                   # El asistente usa el reloj real (no es una campaña de demo): el borrador tiene que ser anterior a hoy.
                   'actualizado_en': ts('2026-11-10', '18:30'),
                   'datos': {
                       'paso': 0,
                       'campana': {'nombre': 'Alcaldía de Maracaibo 2027', 'tipo_eleccion': 'Alcaldía', 'pais': 'Venezuela', 'estado': 'Zulia',
                                   'municipio': 'Maracaibo', 'zona_horaria': 'America/Caracas', 'jornada': E0},
                       'fases': [{'nombre': n, 'inicio': a, 'fin': b} for n, a, b in [
                           ('Precampaña', '2027-05-01', ad(E0, -31)), ('Campaña', ad(E0, -30), ad(E0, -3)), ('Veda', ad(E0, -2), ad(E0, -1)),
                           ('Jornada', E0, E0), ('Post-electoral', ad(E0, 1), ad(E0, 15))]],
                       'figuras': [{'figura_id': 'guanipa', 'relacion': 'Propia', 'terminos': [{'texto': t, 'tipo': 'Nombre'} for t in ['Juan Pablo Guanipa', 'Guanipa']]},
                                   {'figura_id': 'caldera', 'relacion': 'Rival', 'terminos': [{'texto': t, 'tipo': 'Nombre'} for t in ['Luis Caldera', 'Caldera']]},
                                   {'figura_id': 'rosales', 'relacion': 'Aliada', 'terminos': [{'texto': 'Rosales Maracaibo', 'tipo': 'Nombre'}]}],
                       'confirmo_personas_publicas': True,
                       'terminos': [{'texto': t, 'tipo': 'Término'} for t in ['Alcaldía de Maracaibo', 'elecciones Maracaibo', '#Maracaibo2027']]
                                   + [{'texto': t, 'tipo': 'Exclusión'} for t in ['béisbol', 'lotería']],
                       'temas': ['Servicio eléctrico', 'Agua', 'Transporte y vialidad', 'Seguridad', 'Aseo urbano', 'Empleo'],
                       'equipo': [{'persona_id': 'valentina', 'rol': 'Administración'}, {'persona_id': 'andres-v', 'rol': 'Análisis'},
                                  {'persona_id': 'carolina', 'rol': 'Análisis'}, {'nombre': 'Coordinación de la campaña', 'nota': 'Invitación externa · cliente', 'rol': 'Cliente'}]}})

# ====================================================================
# Informe de ejemplo — campaña `informe-ejemplo` (filas crudas para reportes de tipo 'Informe')
# ====================================================================
# Corpus inventado y determinista (RNG con semilla fija) que reproduce la ESTRUCTURA de dos informes de muestra:
#   - de impacto de un evento: entrevista radial del martes 11 de mayo (día base el 10, el 12 parcial hasta las 11:00);
#   - de conversación sobre cuatro ejes del 6 al 10 de mayo.
# Reglas de contenido (docs/semilla.md): fuentes y cuentas genéricas numeradas ("Portal de noticias 7", "@cuenta_opinion_2"),
# textos "de ejemplo" sin citas ni hechos atribuidos a personas reales, cifras inventadas. Va al final para no mover
# ninguna fila de las otras campañas (sus JSON quedan idénticos).
CI = 'informe-ejemplo'
RI = random.Random(20270512)
DB_, DE_, DP_ = '2027-05-10', '2027-05-11', '2027-05-12'   # base, evento, parcial (hasta las 11:00)
DT_ = ['2027-05-06', '2027-05-07', '2027-05-08', '2027-05-09']   # días del tema antes del 10 (el 10 lo cubre el corpus del evento)

add('campanas', dict(base_c, id=CI, nombre='Monitoreo de ejemplo · Venezuela 2027', nombre_corto='Informe de ejemplo', contienda='Presidenciales 2027',
    titulo_largo='Monitoreo de ejemplo · Venezuela 2027', iniciales='ME', ambito='Presidenciales', territorio='Venezuela', fase='Campaña',
    inicio_campana='2027-04-04', fin_campana='2027-06-02', jornada='2027-06-06', figura_propia_id='machado', vista='compacta', orden=4,
    fecha_corte='2027-05-12', periodo_inicio='2027-05-06', periodo_fin='2027-05-12',
    extra={'nota_temas': 'Campaña de ejemplo para el Informe: publicaciones, comentarios y recolecciones con cifras inventadas.', 'avance_fase': 63}))
# Mismo equipo y roles que presidenciales (las cuentas de prueba se suman en rig/usuarios.sql).
for pid, rol in [('lucia', 'Administración'), ('daniela', 'Análisis'), ('andres', 'Análisis'), ('carla', 'Análisis'), ('andrea', 'Análisis'), ('tomas', 'Análisis')]:
    add('miembros_campana', {'id': f'inf-m-{pid}', 'campana_id': CI, 'persona_id': pid, 'rol': rol})
add('campana_fases', {'id': 'inf-fase-campana', 'campana_id': CI, 'nombre': 'Campaña', 'inicio': '2027-04-04', 'fin': '2027-06-02', 'orden': 1})
for i, f, rel, o, ex in [('inf-machado', 'machado', 'Propia', 1, {'candidatura': True}), ('inf-delcy-rodriguez', 'delcy-rodriguez', 'Rival', 2, {}),
                         ('inf-capriles', 'capriles', 'Rival', 3, {}), ('inf-gonzalez-urrutia', 'gonzalez-urrutia', 'Aliada', 4, {})]:
    r = {'id': i, 'campana_id': CI, 'figura_id': f, 'relacion': rel, 'orden': o}
    if ex: r['extra'] = ex
    add('campana_figuras', r)

EV_INF = 'inf-entrevista-radial'
add('eventos', {'id': EV_INF, 'campana_id': CI, 'nombre': 'Entrevista radial (ejemplo)', 'tipo': 'Entrevista', 'origen': 'Propio', 'estado': 'En análisis',
                'fecha_inicio': DE_, 'fecha_fin': DE_, 'hora': '08:30', 'sede': 'Emisora de radio', 'ciudad': 'Caracas', 'nota_estado': 'Resultados preliminares',
                'extra': {'hora_fin': '09:15', 'hora_estimada': True, 'estado_region': 'Distrito Capital'}})

# ---------- ejes ----------
EJ = {}
for o, (k, nombre, regla, terminos, color) in enumerate([
        ('conversacion', 'Sobre la figura o el evento', 'El texto o el titular nombra a la figura propia, la entrevista, la emisora anfitriona o su programa.',
         ['figura propia (nombre y apellido)', 'entrevista', 'emisora anfitriona', 'programa de ejemplo'], None),
        ('foco', 'Sobre el evento', 'Trata la entrevista: en X, la marca de la emisora o la palabra entrevista junto a la figura; en Instagram, YouTube y noticias, lista revisada a mano.',
         ['entrevista', 'emisora anfitriona', 'en vivo'], None),
        ('anfitrion', 'Nombra al medio anfitrión', 'El texto nombra a la emisora anfitriona, su programa o su conductora.', ['emisora anfitriona', 'programa de ejemplo'], None),
        ('figura', 'Figura propia', 'El texto o el titular nombra a la figura propia por su nombre o su apellido.', ['nombre de la figura propia', 'apellido de la figura propia'], '#2F6B4F'),
        ('servicios', 'Servicios públicos', 'Nombra luz, agua, gas o transporte junto a una palabra de falla, corte o servicio.', ['luz', 'agua', 'gas', 'transporte', 'corte', 'falla'], '#3B6EA8'),
        ('fecha', 'Fecha electoral', 'Nombra la fecha, el cronograma o la jornada de la elección.', ['fecha electoral', 'cronograma', 'jornada electoral', 'elecciones'], '#B8742A'),
        ('economia', 'Economía y salarios', 'Nombra salario, precios, bolívares, dólar o empleo.', ['salario', 'precios', 'bolívares', 'dólar', 'empleo'], '#7A4E9C')], 1):
    EJ[k] = f'inf-eje-{k}'
    r = {'id': EJ[k], 'campana_id': CI, 'nombre': nombre, 'regla': regla, 'terminos': terminos, 'orden': o}
    if color: r['color'] = color
    add('ejes', r)
EJES_TEMA = ['figura', 'servicios', 'fecha', 'economia']

# ---------- autores (cuentas que publican; nunca autores de comentarios) ----------
DOM = {'X': 'x.example', 'Instagram': 'instagram.example', 'TikTok': 'tiktok.example', 'YouTube': 'youtube.example', 'Facebook': 'facebook.example'}
SL = {'X': 'x', 'Instagram': 'ig', 'TikTok': 'tt', 'YouTube': 'yt', 'Facebook': 'fb', 'Medio digital': 'nt'}
AUT = {}            # id -> fila (con _grupo)
GRUPOS = {}         # (canal, grupo) -> [ids]
FIG_TXT = 'Cuenta oficial de una figura en seguimiento'
def autor(canal, handle, nombre, tipo, org, seg, grupo, figura=None, descriptor=None):
    clave = handle.lstrip('@')
    aid = f'inf-a-{SL[canal]}-{clave.replace("_", "-")}'
    r = {'id': aid, 'campana_id': CI, 'canal': canal, 'handle': handle, 'tipo': tipo, 'es_organizacion': org, 'url': f'https://{DOM[canal]}/{clave}'}
    if nombre: r['nombre'] = nombre
    if seg is not None: r['seguidores'] = seg
    if figura: r['figura_id'] = figura
    if descriptor: r['descriptor'] = descriptor
    add('autores', r)
    AUT[aid] = dict(r, _grupo=grupo)
    GRUPOS.setdefault((canal, grupo), []).append(aid)
    return aid

MEDIOS_X = [('portal_noticias_1', 2354000), ('portal_noticias_2', 770000), ('portal_noticias_3', 1263000), ('portal_noticias_4', 698000),
            ('medio_digital_4', 429000), ('medio_regional_3', 114000), ('diario_digital_2', 86000)]
def rotulo(h):  # 'portal_noticias_3' -> 'Portal de noticias 3'
    base, n = h.rsplit('_', 1)
    return {'portal_noticias': 'Portal de noticias', 'medio_digital': 'Medio digital', 'medio_regional': 'Medio regional', 'diario_digital': 'Diario digital'}[base] + ' ' + n
for h, s in MEDIOS_X:
    autor('X', '@' + h, rotulo(h), 'Medio', True, s, 'medio')
A_EMI = {'X': autor('X', '@emisora_ejemplo', 'Emisora de ejemplo', 'Emisora', True, 85000, 'emisora')}
A_PAR1 = {'X': autor('X', '@partido_ejemplo_1', 'Partido de ejemplo 1', 'Partido u organización', True, 327000, 'partido')}
autor('X', '@partido_ejemplo_2', 'Partido de ejemplo 2', 'Partido u organización', True, 41500, 'partido', descriptor='área de derechos humanos de un partido')
A_CAM = {'X': autor('X', '@campana_ejemplo_1', 'Campaña de ejemplo 1', 'Campaña política', True, 210000, 'campana')}
A_FIG = {'X': autor('X', '@cuenta_oficial_figura_1', FIG_TXT, 'Campaña política', False, 6400000, 'figura', figura='machado', descriptor=FIG_TXT.lower())}
VOCES = {}
for h, n, t, s, d in [('periodista_ejemplo_1', 'Periodista de ejemplo 1', 'Periodista', 351000, None),
                      ('periodista_ejemplo_2', 'Periodista de ejemplo 2', 'Periodista', 170000, 'fotoperiodista'),
                      ('periodista_ejemplo_3', 'Periodista de ejemplo 3', 'Periodista', 62000, None),
                      ('cuenta_opinion_1', 'Cuenta de opinión 1', 'Cuenta de opinión con gran audiencia', 136500, None),
                      ('cuenta_opinion_2', 'Cuenta de opinión 2', 'Cuenta de opinión con gran audiencia', 112500, None),
                      ('cuenta_opinion_3', 'Cuenta de opinión 3', 'Cuenta de opinión con gran audiencia', 236900, None),
                      ('analista_ejemplo_1', 'Analista de ejemplo 1', 'Analista', 621000, 'escritor y analista político'),
                      ('analista_ejemplo_2', 'Analista de ejemplo 2', 'Analista', 1178000, 'periodista y analista político'),
                      ('cuenta_sin_confirmar_1', None, 'Tipo no confirmado', 48000, None)]:
    VOCES[h] = autor('X', '@' + h, n, t, False, s, 'voz', descriptor=d)
PERS_X = [autor('X', f'@cuenta_personal_{i}', None, 'Cuenta personal', False, RI.randint(80, 45000), 'personal') for i in range(1, 23)]
# Instagram: la recolección no trae seguidores (solo se publican organizaciones y la cuenta de la figura).
for h in ['portal_noticias_1', 'portal_noticias_2', 'medio_digital_4', 'medio_regional_3', 'diario_digital_2']:
    autor('Instagram', '@' + h, rotulo(h), 'Medio', True, None, 'medio')
A_EMI['Instagram'] = autor('Instagram', '@emisora_ejemplo', 'Emisora de ejemplo', 'Emisora', True, None, 'emisora')
A_PAR1['Instagram'] = autor('Instagram', '@partido_ejemplo_1', 'Partido de ejemplo 1', 'Partido u organización', True, None, 'partido')
A_PAR2_IG = autor('Instagram', '@partido_ejemplo_2', 'Partido de ejemplo 2', 'Partido u organización', True, None, 'partido', descriptor='área de derechos humanos de un partido')
A_CAM['Instagram'] = autor('Instagram', '@campana_ejemplo_1', 'Campaña de ejemplo 1', 'Campaña política', True, None, 'campana')
A_FIG['Instagram'] = autor('Instagram', '@cuenta_oficial_figura_1', FIG_TXT, 'Campaña política', False, 3100000, 'figura', figura='machado', descriptor=FIG_TXT.lower())
PERS_IG = [autor('Instagram', f'@cuenta_personal_ig_{i}', None, 'Cuenta personal', False, None, 'personal') for i in range(1, 5)]
A_PAR1['TikTok'] = autor('TikTok', '@partido_ejemplo_1', 'Partido de ejemplo 1', 'Partido u organización', True, 497273, 'partido')
A_PAR1_EXT = autor('TikTok', '@partido_ejemplo_1_exterior', 'Partido de ejemplo 1 (exterior)', 'Partido u organización', True, 14635, 'partido', descriptor='rama en el exterior')
A_EMI['TikTok'] = autor('TikTok', '@emisora_ejemplo', 'Emisora de ejemplo', 'Emisora', True, 48000, 'emisora')
TNC = [autor('TikTok', f'@canal_video_{i}', None, 'Tipo no confirmado', False, s, 'tnc') for i, s in enumerate([2502364, 125704, 313714, 151436], 1)]
A_FIG['TikTok'] = autor('TikTok', '@cuenta_oficial_figura_1', FIG_TXT, 'Campaña política', False, 905000, 'figura', figura='machado',
                        descriptor='cuenta probable de la figura, sin confirmación oficial')
PERS_TT = [autor('TikTok', f'@cuenta_personal_tt_{i}', None, 'Cuenta personal', False, RI.randint(200, 30000), 'personal') for i in range(1, 4)]
A_EMI['YouTube'] = autor('YouTube', '@emisora_ejemplo', 'Emisora de ejemplo', 'Emisora', True, 14600, 'emisora')
A_OPI_YT = autor('YouTube', '@canal_opinion_1', 'Canal de opinión 1', 'Tipo no confirmado', False, 119000, 'tnc')
autor('YouTube', '@portal_noticias_2', 'Portal de noticias 2', 'Medio', True, 540000, 'medio')
A_PERS_YT = autor('YouTube', '@cuenta_personal_yt_1', None, 'Cuenta personal', False, 900, 'personal')
A_PAR1['Facebook'] = autor('Facebook', '@partido_ejemplo_1', 'Partido de ejemplo 1', 'Partido u organización', True, 614000, 'partido', descriptor='página de Facebook')
for h, s in [('portal_noticias_1', 1500000), ('portal_noticias_3', 2800000), ('portal_noticias_4', 2400000), ('medio_digital_4', 404000),
             ('medio_regional_3', 210000), ('diario_digital_2', 95000)]:
    autor('Facebook', '@' + h, rotulo(h), 'Medio', True, s, 'medio', descriptor='página de Facebook')
AID = lambda canal, h: f'inf-a-{SL[canal]}-{h.replace("_", "-")}'

# ---------- recolecciones (ids primero: las filas se arman al final con los conteos reales) ----------
REC = {}
def rid(*partes):
    return 'inf-rec-' + '-'.join(partes)

# ---------- menciones ----------
MI = {}        # id -> fila (para comentarios, muestras y recolecciones)
EXT = {c: 0 for c in SL}
NOTICIA_URL = lambda f, n: f'https://noticias.example/{f.lower().replace(" ", "-").replace("ó", "o").replace("í", "i")}/{n}'
def inst(dia, h, m, s=0):
    return f'{dia}T{h:02d}:{m:02d}:{s:02d}{TZ}'
def metr(canal, grupo, formato):
    """Métricas inventadas por canal, tipo de cuenta y formato. Vistas solo en X y en videos o reels."""
    ln = lambda med, sg=1.0, tope=None: (lambda v: min(v, tope) if tope else v)(max(1, int(RI.lognormvariate(math.log(med), sg))))
    u = RI.uniform
    if canal == 'X':
        v = ln({'medio': 1500, 'emisora': 800, 'partido': 3000, 'campana': 2500, 'figura': 10000, 'voz': 2500}.get(grupo, 200), 1.0, 15000)
        return v, round(v * u(.008, .035)), round(v * u(.0008, .004)), round(v * u(.002, .012))
    if canal == 'Instagram':
        if formato == 'Reel':
            v = ln({'medio': 12000, 'emisora': 3000, 'partido': 25000, 'campana': 20000, 'figura': 60000}.get(grupo, 2000), .9, 80000)
            me = round(v * u(.04, .09))
        else:
            v, me = None, ln({'medio': 400, 'emisora': 150, 'partido': 1500, 'campana': 900, 'figura': 6000}.get(grupo, 120), .8, 9000)
        return v, me, round(me * u(.02, .07)), None
    if canal == 'TikTok':
        v = ln({'partido': 8000, 'tnc': 3000, 'figura': 12000, 'emisora': 1500}.get(grupo, 600), 1.0, 30000)
        return v, round(v * u(.06, .15)), round(v * u(.004, .015)), round(v * u(.003, .012))
    if canal == 'YouTube':
        v = ln({'medio': 1500, 'tnc': 1200, 'emisora': 400}.get(grupo, 50), .9, 8000)
        return v, round(v * u(.03, .08)), round(v * u(.005, .02)), None
    if canal == 'Facebook':
        me = ln({'partido': 900}.get(grupo, 120), .9, 5000)
        v = ln({'partido': 6000}.get(grupo, 1500), .9, 12000) if formato == 'Video' else None
        return v, me, round(me * u(.08, .2)), round(me * u(.05, .15))
    return None, None, None, None
def formato_de(canal, grupo):
    if canal == 'X': return RI.choices(['Texto', 'Foto', 'Video'], [70, 18, 12])[0]
    if canal == 'Instagram': return 'Reel' if RI.random() < (.6 if grupo != 'personal' else .4) else 'Foto'
    if canal == 'TikTok': return 'Video'
    if canal == 'YouTube': return 'Video'
    if canal == 'Facebook': return 'Video' if RI.random() < .4 else RI.choice(['Foto', 'Texto'])
    return 'Artículo'
def sent_auto():
    return RI.choices(['Favorable', 'Neutral', 'Desfavorable'], [31, 50, 19])[0]

def mencion(canal, cuando, texto, autor_id=None, fuente=None, formato=None, metricas=None, tipo_pub='Original', en_tema=True, otro_pais=False,
            figura=None, evento=None, sent=None, titulo=None):
    EXT[canal] += 1
    n = EXT[canal]
    mid = f'inf-{SL[canal]}-{n}'
    r = {'id': mid, 'campana_id': CI, 'canal': canal, 'publicada_en': cuando, 'estado': 'Procesada', 'origen': 'Ingesta', 'tipo_pub': tipo_pub,
         'otro_pais': otro_pais, 'en_tema': en_tema, 'id_externo': f'{SL[canal]}{100000 + n}', 'texto': texto}
    if canal == 'Medio digital':
        r.update({'fuente': fuente, 'fuente_tipo': 'Medio', 'titulo': titulo or texto, 'formato': 'Artículo', 'url': NOTICIA_URL(fuente, 100000 + n)})
        r['texto'] = None
        del r['texto']
    else:
        a = AUT[autor_id]
        g = a['_grupo']
        formato = formato or formato_de(canal, g)
        v, me, re_, co = metricas if metricas is not None else metr(canal, g, formato)
        r.update({'autor_id': autor_id, 'titulo': titulo or texto, 'formato': formato,
                  'fuente': FIG_TXT if g == 'figura' else (a.get('nombre') if a['es_organizacion'] else 'Cuenta pública'),
                  'fuente_tipo': 'Medio' if g in ('medio', 'emisora') else 'Oficial' if g in ('partido', 'campana', 'figura') else 'Ciudadana',
                  'url': f'https://{DOM[canal]}/{a["handle"].lstrip("@")}/{r["id_externo"]}'})
        for k, x in (('vistas', v), ('me_gusta', me), ('respuestas', re_), ('compartidos', co)):
            if x is not None: r[k] = x
        partes = [x for x in (me, re_, co) if x is not None]
        if partes: r['interacciones'] = sum(partes)
        if v is not None: r['alcance'] = v
    if figura: r['figura_id'] = figura
    if evento: r['evento_id'] = evento
    if sent: r['sentimiento'] = sent
    add('menciones', r)
    MI[mid] = r | {'_ejes': {}}
    return mid

NME = {'n': 0}
def eje(mid, k, metodo='Regla', rec=None):
    if EJ[k] in MI[mid]['_ejes']: return
    r = {'id': f'{mid}-{k}', 'campana_id': CI, 'mencion_id': mid, 'eje_id': EJ[k], 'metodo': metodo}
    if rec: r['recoleccion_id'] = rec
    add('mencion_ejes', r)
    MI[mid]['_ejes'][EJ[k]] = metodo

def instantes(dia, n, pesos, minimo=None):
    """n instantes del día con la forma horaria `pesos` (24 valores). minimo=(h, m): nada antes de esa hora."""
    out = []
    for h, k in enumerate(reparto(pesos, n)):
        for _ in range(k):
            lo = minimo[1] if minimo and h == minimo[0] else 0
            out.append(inst(dia, h, RI.randint(lo, 59), RI.randint(0, 59)))
    RI.shuffle(out)
    return out
W_BASE = [.55, .4, .3, .25, .25, .4, .7, 1.0, 1.25, 1.35, 1.35, 1.3, 1.25, 1.2, 1.2, 1.2, 1.2, 1.25, 1.3, 1.35, 1.4, 1.35, 1.15, .85]
W_EV = W_BASE[:7] + [1.2, 1.6, 1.9, 1.6, 1.4] + W_BASE[12:]
W_FOCO = [0] * 7 + [.02, .2, .28, .17, .08, .05, .035, .03, .025, .02] + [.015] * 7
W_PART = W_BASE[:11] + [0] * 13
W_FOCO_P = [.3, .2, .1, .05, .05, .2, .5, 1.0, 1.2, 1.1, 1.0] + [0] * 13

def elegir(canal, pesos):
    g = RI.choices(list(pesos), list(pesos.values()))[0]
    return RI.choice(GRUPOS[(canal, g)])

# Textos de ejemplo (sin citas ni hechos atribuidos a personas reales).
TX = {
    'v': ['Publicación de ejemplo que comenta la agenda de la figura propia.', 'Publicación de ejemplo con una opinión sobre la figura propia.',
          'Respuesta de ejemplo en una conversación sobre la figura propia.', 'Publicación de ejemplo que comparte una nota sobre la figura propia.',
          'Publicación de ejemplo sobre la campaña de la figura propia.'],
    'f': ['Publicación de ejemplo que comenta la entrevista radial de la figura propia.', 'Publicación de ejemplo que resume lo dicho en la entrevista radial.',
          'Publicación de ejemplo con un fragmento en video de la entrevista.', 'Publicación de ejemplo que valora la entrevista.'],
    'fc': ['Publicación de ejemplo que comenta la entrevista en la emisora anfitriona.', 'Publicación de ejemplo que anuncia la entrevista en la emisora anfitriona.',
           'Publicación de ejemplo con un fragmento de la entrevista y el nombre del programa.'],
    'c': ['Publicación de ejemplo que nombra a la emisora anfitriona y a la figura propia.'],
    'op': ['Publicación de ejemplo desde otro país que nombra a la figura propia.'],
    'nc': ['Publicación de ejemplo devuelta por la búsqueda que no trata a la figura propia.'],
    'off': ['Publicación de ejemplo de la emisora sobre otro tema de su programación.', 'Publicación de ejemplo de la emisora con su programación del día.'],
}
TN = {
    'v': ['Nota de ejemplo sobre la agenda de la figura propia', 'Nota de ejemplo sobre la campaña de la figura propia', 'Nota de ejemplo con declaraciones sobre la campaña'],
    'f': ['Nota de ejemplo sobre la entrevista radial de la figura propia', 'Nota de ejemplo que resume los temas de la entrevista radial',
          'Nota de ejemplo sobre lo dicho en la entrevista radial'],
    'fc': ['Nota de ejemplo sobre la entrevista en la emisora anfitriona'],
    'nc': ['Nota de ejemplo sobre otros temas de la campaña', 'Nota de ejemplo sobre la agenda política nacional'],
    'op': ['Nota de ejemplo de un medio de otro país que nombra a la figura propia'],
}
FUENTES_NT = ([f'Portal de noticias {i}' for i in range(1, 10)] + [f'Medio regional {i}' for i in range(1, 5)] + [f'Diario digital {i}' for i in range(1, 4)]
              + ['Diario nacional 1', 'Diario nacional 2', 'Medio digital nacional 2', 'Emisora de radio 2', 'Canal de noticias de TV 1'])
PESO_NT = [9, 8, 7, 6, 6, 5, 5, 4, 3, 4, 3, 3, 2, 4, 3, 2, 4, 3, 3, 2, 2]

# Pesos de cuentas por canal (grupo -> peso).
P_X = {'medio': .25, 'emisora': .005, 'partido': .02, 'campana': .015, 'figura': .01, 'voz': .09, 'personal': .61}
P_X_FOCO = {'medio': .2, 'emisora': .02, 'partido': .03, 'campana': .03, 'figura': .01, 'voz': .14, 'personal': .57}
P_IG = {'medio': .45, 'partido': .2, 'campana': .1, 'figura': .08, 'personal': .17}
P_TT = {'partido': .15, 'tnc': .45, 'figura': .1, 'personal': .3}
P_YT = {'medio': .3, 'tnc': .4, 'personal': .3}
P_FB = {'partido': .3, 'medio': .7}
PESOS = {'X': P_X, 'Instagram': P_IG, 'TikTok': P_TT, 'YouTube': P_YT, 'Facebook': P_FB}

def ejes_evento(mid, cat, canal, dia, busqueda=False):
    """Marca conversación, foco y comparación según la categoría. cat: fc, f, c, v, op, nc, off."""
    if cat in ('nc', 'off'): return
    rec_conv = rid('x', dia) if canal == 'X' else REC_CANAL_EV.get(canal)
    eje(mid, 'conversacion', 'Regla', rec_conv)
    if cat in ('fc', 'f'):
        if canal == 'X':
            eje(mid, 'foco', 'Búsqueda' if busqueda else 'Regla', rid('x', 'foco') if dia == DE_ else None)
        else:
            eje(mid, 'foco', 'Manual' if canal in ('Medio digital', 'Instagram', 'YouTube') else 'Regla')
    if cat in ('fc', 'c'):
        eje(mid, 'anfitrion', 'Regla')
REC_CANAL_EV = {'Medio digital': rid('nt', 'evento'), 'Instagram': rid('ig', 'cuentas', 'evento'), 'TikTok': rid('tt', 'palabras', 'evento'),
                'YouTube': rid('yt', 'cuentas', 'evento'), 'Facebook': rid('fb', 'paginas', 'evento')}

# Publicaciones explícitas del evento (las que el informe destaca). Cifras inventadas.
EVX = {}
def explicita(clave, canal, cuando, cat, texto, autor_id=None, fuente=None, formato=None, m=None, tipo_pub='Original', en_tema=True):
    dia = cuando[:10]
    mid = mencion(canal, cuando, texto, autor_id=autor_id, fuente=fuente, formato=formato, metricas=m, tipo_pub=tipo_pub, en_tema=en_tema,
                  figura='machado' if cat not in ('nc', 'off') else None, evento=EV_INF if cat in ('fc', 'f') else None,
                  sent=sent_auto() if cat not in ('nc', 'off') else None)
    ejes_evento(mid, cat, canal, dia)
    EVX[clave] = mid
    return mid
EXPL = {}   # (canal, dia, cat) -> cuántas explícitas
def cuenta_expl(canal, cuando, cat):
    EXPL[(canal, cuando[:10], cat)] = EXPL.get((canal, cuando[:10], cat), 0) + 1

for args in [
    # Instagram: la emisora (4 publicaciones sobre la entrevista), el partido, la campaña, un medio y una cuenta personal.
    ('E1', 'Instagram', inst(DB_, 20, 0), 'fc', 'Anuncio de ejemplo de la entrevista en la emisora anfitriona.', A_EMI['Instagram'], None, 'Foto', (None, 349, 22, None)),
    ('E2', 'Instagram', inst(DE_, 8, 35), 'fc', 'Clip de ejemplo de la entrevista, publicado junto con la cuenta de la figura.', A_EMI['Instagram'], None, 'Reel', (162500, 13960, 396, None)),
    ('E3', 'Instagram', inst(DE_, 10, 5), 'fc', 'Publicación de ejemplo sobre el invitado del programa.', A_EMI['Instagram'], None, 'Reel', (3032, 386, 52, None)),
    ('E4', 'Instagram', inst(DP_, 7, 0), 'fc', 'Nota de ejemplo de la emisora sobre la entrevista del día anterior.', A_EMI['Instagram'], None, 'Foto', (None, 69, 3, None)),
    ('E5', 'Instagram', inst(DE_, 9, 33), 'fc', 'Video de ejemplo con fragmentos de la entrevista radial.', A_PAR1['Instagram'], None, 'Reel', (169900, 23300, 1220, None)),
    ('E6', 'Instagram', inst(DE_, 8, 46), 'f', 'Clip de ejemplo de la entrevista sobre organización comunitaria.', A_CAM['Instagram'], None, 'Reel', (57200, 3800, 200, None)),
    ('E7', 'Instagram', inst(DE_, 8, 29), 'f', 'Clip de ejemplo publicado al inicio de la entrevista.', A_CAM['Instagram'], None, 'Reel', (50700, 3000, 140, None)),
    ('E8', 'Instagram', inst(DE_, 10, 37), 'fc', 'Clip de ejemplo de un medio con fragmentos de la entrevista.', AID('Instagram', 'portal_noticias_1'), None, 'Reel', (15200, 600, 27, None)),
    ('E9', 'Instagram', inst(DE_, 14, 41), 'f', 'Publicación de ejemplo que resume la entrevista.', PERS_IG[0], None, 'Foto', (None, 2650, 100, None)),
    # TikTok
    ('T1', 'TikTok', inst(DE_, 9, 24), 'f', 'Video de ejemplo con un fragmento de la entrevista sobre el registro para votar.', A_PAR1['TikTok'], None, 'Video', (98600, 18100, 1050, 450)),
    ('T2', 'TikTok', inst(DE_, 8, 59), 'fc', 'Video de ejemplo de una rama en el exterior sobre la entrevista.', A_PAR1_EXT, None, 'Video', (26400, 3900, 220, 160)),
    ('T3', 'TikTok', inst(DE_, 22, 30), 'fc', 'Video de ejemplo que comenta la entrevista radial.', TNC[0], None, 'Video', (16700, 1500, 120, 80)),
    ('T4', 'TikTok', inst(DE_, 8, 25), 'off', 'Clip automático de ejemplo del en vivo de la emisora.', A_EMI['TikTok'], None, 'En vivo', (5060, 397, 34, 10)),
    ('T5', 'TikTok', inst(DE_, 8, 44), 'off', 'Clip automático de ejemplo del en vivo de la emisora.', A_EMI['TikTok'], None, 'En vivo', (1966, 138, 7, 3)),
    # YouTube
    ('Y1', 'YouTube', inst(DE_, 9, 18), 'fc', 'Video de ejemplo del programa completo con la entrevista (44 minutos).', A_EMI['YouTube'], None, 'En vivo', (4513, 307, 50, None)),
    ('Y2', 'YouTube', inst(DP_, 10, 0), 'f', 'Video de ejemplo de un canal de opinión que comenta la entrevista.', A_OPI_YT, None, 'Video', (905, 180, 16, None)),
    ('Y3', 'YouTube', inst(DE_, 12, 49), 'f', 'Video de ejemplo que comparte la entrevista.', A_PERS_YT, None, 'Video', (6, 0, 0, None)),
    # Facebook: dos videos de la página del partido concentran casi todos los comentarios.
    ('F1', 'Facebook', inst(DE_, 9, 33), 'fc', 'Video de ejemplo con fragmentos de la entrevista radial.', A_PAR1['Facebook'], None, 'Video', (212800, 24600, 2820, 1650)),
    ('F2', 'Facebook', inst(DE_, 9, 15), 'fc', 'Video de ejemplo con una pregunta de la entrevista sobre participación.', A_PAR1['Facebook'], None, 'Video', (16700, 2400, 290, 220)),
    ('F3', 'Facebook', inst(DE_, 8, 56), 'fc', 'Video de ejemplo con el inicio de la entrevista.', A_PAR1['Facebook'], None, 'Video', (1950, 300, 40, 37)),
    ('F4', 'Facebook', inst(DE_, 9, 43), 'fc', 'Video de ejemplo de un medio sobre la entrevista.', AID('Facebook', 'portal_noticias_1'), None, 'Video', (660, 25, 4, 2)),
    ('F5', 'Facebook', inst(DE_, 10, 35), 'fc', 'Video de ejemplo de un medio con un fragmento de la entrevista.', AID('Facebook', 'medio_digital_4'), None, 'Video', (616, 50, 8, 7)),
    # X: la publicación con más vistas es de una cuenta personal (sale como "Cuenta personal").
    ('X1', 'X', inst(DE_, 9, 43), 'fc', 'Publicación de ejemplo que resume en tercera persona un tema de la entrevista.', PERS_X[0], None, 'Video', (47600, 1800, 90, 200)),
    ('X2', 'X', inst(DE_, 9, 35), 'fc', 'Publicación de ejemplo que anuncia la entrevista en curso.', VOCES['periodista_ejemplo_1'], None, 'Video', (35300, 3300, 120, 750)),
    ('X3', 'X', inst(DE_, 9, 30), 'fc', 'Publicación de ejemplo sobre la entrevista en la emisora anfitriona.', VOCES['periodista_ejemplo_1'], None, 'Texto', (21300, 1700, 60, 400)),
    ('X4', 'X', inst(DE_, 8, 59), 'fc', 'Publicación de ejemplo con un fragmento de la entrevista.', A_PAR1['X'], None, 'Video', (33300, 240, 20, 36)),
    ('X5', 'X', inst(DE_, 10, 18), 'f', 'Publicación de ejemplo que difunde la entrevista.', VOCES['cuenta_opinion_1'], None, 'Video', (24900, 520, 40, 85)),
    ('X6', 'X', inst(DE_, 8, 44), 'fc', 'Publicación de ejemplo que anuncia la primera entrevista radial de la semana.', A_CAM['X'], None, 'Foto', (22600, 380, 30, 64)),
    ('X7', 'X', inst(DE_, 10, 51), 'f', 'Publicación de ejemplo con una valoración de la entrevista.', PERS_X[1], None, 'Texto', (18600, 800, 60, 100)),
    ('X8', 'X', inst(DE_, 11, 20), 'f', 'Publicación crítica de ejemplo sobre la entrevista.', VOCES['analista_ejemplo_1'], None, 'Texto', (15000, 900, 50, 210)),
    ('X9', 'X', inst(DE_, 7, 36), 'fc', 'Publicación de ejemplo de un medio que anuncia la entrevista de esta mañana.', AID('X', 'portal_noticias_3'), None, 'Texto', (4200, 60, 5, 22)),
]:
    clave, canal, cuando, cat, texto, aid, fuente, formato, m = args
    explicita(clave, canal, cuando, cat, texto, autor_id=aid, fuente=fuente, formato=formato, m=m, en_tema=cat != 'off')
    cuenta_expl(canal, cuando, cat)
# Noticias sobre la entrevista: lista revisada a mano (todas explícitas), la primera a las 09:31.
for i, (dia, hm, f, cat) in enumerate([(DE_, '09:31', 'Portal de noticias 1', 'f'), (DE_, '09:58', 'Portal de noticias 1', 'f'), (DE_, '10:15', 'Diario digital 1', 'fc'),
                                       (DE_, '10:42', 'Medio regional 1', 'f'), (DE_, '11:14', 'Portal de noticias 5', 'f'), (DE_, '12:02', 'Medio digital nacional 2', 'f'),
                                       (DE_, '13:09', 'Portal de noticias 6', 'f'), (DE_, '13:41', 'Diario nacional 1', 'f'), (DE_, '15:19', 'Emisora de radio 2', 'fc'),
                                       (DE_, '17:06', 'Medio regional 2', 'f'), (DE_, '19:37', 'Canal de noticias de TV 1', 'f'), (DP_, '05:36', 'Medio regional 3', 'f')]):
    h, m_ = map(int, hm.split(':'))
    explicita(f'N{i + 1}', 'Medio digital', inst(dia, h, m_), cat, None, fuente=f, )
    MI[EVX[f'N{i + 1}']]['titulo'] = None
    cuenta_expl('Medio digital', dia, cat)
# Los titulares de las noticias explícitas (se fijan después para no repetir).
for i, k in enumerate([f'N{j}' for j in range(1, 13)]):
    t = ['Nota de ejemplo sobre la entrevista radial de la figura propia', 'Nota de ejemplo sobre una propuesta de servicios mencionada en la entrevista',
         'Nota de ejemplo que nombra a la emisora anfitriona y resume la entrevista', 'Nota de ejemplo que resume los temas de la entrevista radial',
         'Nota de ejemplo sobre lo dicho en la entrevista acerca de las instituciones', 'Nota de ejemplo sobre la primera entrevista radial de la semana',
         'Nota de ejemplo con fragmentos de la entrevista', 'Nota de ejemplo sobre la transición mencionada en la entrevista',
         'Nota de ejemplo de una emisora local que comenta la entrevista en otra emisora', 'Nota de ejemplo sobre los temas económicos de la entrevista',
         'Nota de ejemplo de un canal de noticias sobre la entrevista', 'Nota de ejemplo del día siguiente sobre la entrevista'][i]
    for f in T['menciones']:
        if f['id'] == EVX[k]: f['titulo'] = t
    MI[EVX[k]]['titulo'] = t

# Conteos del evento por canal y día: fc = foco que nombra al anfitrión, f = foco, c = conversación que nombra al anfitrión,
# v = conversación, op = otro país, nc = filas sin la figura, off = filas fuera de tema (en_tema = false).
CNT = {
    'X': {DB_: dict(c=1, v=669, op=7, nc=8), DE_: dict(fc=100, f=40, c=23, v=717, op=9, nc=12), DP_: dict(fc=10, f=6, c=2, v=167, op=2, nc=4)},
    'Medio digital': {DB_: dict(v=20, nc=4), DE_: dict(fc=2, f=9, v=19, op=1, nc=7), DP_: dict(f=1, v=6, nc=2)},
    'Instagram': {DB_: dict(fc=1, v=21, nc=2, off=3), DE_: dict(fc=13, f=3, c=2, v=12, op=1, nc=3, off=5), DP_: dict(fc=1, v=4, nc=1, off=3)},
    'TikTok': {DB_: dict(v=5, off=4), DE_: dict(fc=8, f=3, v=4, off=13), DP_: dict(f=1, v=1, off=3)},
    'YouTube': {DB_: dict(v=1, off=3), DE_: dict(fc=1, f=1, v=1, off=3), DP_: dict(f=1, off=3)},
    'Facebook': {DB_: dict(v=6), DE_: dict(fc=5, v=2), DP_: dict(v=1)},
}
BUSQ = {DE_: 12, DP_: 2}   # foco de X solo por Búsqueda (fuera de los rankings)
for canal, dias in CNT.items():
    for dia, cats in dias.items():
        for cat, total in cats.items():
            n = total - EXPL.get((canal, dia, cat), 0)
            assert n >= 0, (canal, dia, cat)
            if not n: continue
            if cat in ('fc', 'f'):
                pesos, mini = (W_FOCO, (8, 25)) if dia == DE_ else (W_FOCO_P, None) if dia == DP_ else (W_BASE, None)
            else:
                pesos, mini = {DB_: W_BASE, DE_: W_EV, DP_: W_PART}[dia], None
            busq = BUSQ.get(dia, 0) if (canal == 'X' and cat == 'f') else 0
            for j, cuando in enumerate(instantes(dia, n, pesos, mini)):
                if canal == 'Medio digital':
                    f = RI.choices(FUENTES_NT, PESO_NT)[0]
                    mid = mencion(canal, cuando, None, fuente=f, titulo=RI.choice(TN[cat if cat in TN else 'v']), otro_pais=cat == 'op',
                                  figura='machado' if cat not in ('nc',) else None, evento=EV_INF if cat in ('fc', 'f') else None,
                                  sent=sent_auto() if cat != 'nc' else None)
                else:
                    if cat == 'off':
                        aid = A_EMI[canal]
                    else:
                        p = P_X_FOCO if (canal == 'X' and cat in ('fc', 'f', 'c')) else PESOS[canal]
                        if canal == 'Instagram' and cat in ('fc', 'f', 'c'): p = {k: w for k, w in p.items() if k != 'personal'} | {'personal': .05}
                        aid = elegir(canal, p)
                    tp = RI.choices(['Original', 'Respuesta', 'Cita'], [52, 40, 8])[0] if canal == 'X' else 'Original'
                    mid = mencion(canal, cuando, RI.choice(TX[cat]), autor_id=aid, tipo_pub=tp, en_tema=cat != 'off', otro_pais=cat == 'op',
                                  figura='machado' if cat not in ('nc', 'off') else None, evento=EV_INF if cat in ('fc', 'f') else None,
                                  sent=sent_auto() if cat not in ('nc', 'off') else None)
                ejes_evento(mid, cat, canal, dia, busqueda=j < busq)

# El día base también es el último día del informe de tema: la conversación sobre la figura entra en sus ejes.
for mid, r in list(MI.items()):
    if r['publicada_en'][:10] != DB_ or EJ['conversacion'] not in r['_ejes'] or r['canal'] in ('TikTok', 'YouTube'):
        continue
    rec = rid('x', DB_) if r['canal'] == 'X' else REC_CANAL_EV[r['canal']]
    if RI.random() < .62: eje(mid, 'figura', 'Regla', rec)
    for k, p in (('fecha', .12), ('economia', .08), ('servicios', .04)):
        if RI.random() < p: eje(mid, k, 'Regla', rec)
    if not set(MI[mid]['_ejes']) & {EJ[k] for k in EJES_TEMA}:   # la búsqueda del 10 trae cada fila por algún término del tema
        eje(mid, RI.choices(['fecha', 'economia', 'servicios'], [.45, .35, .2])[0], 'Regla', rec)

# ---------- corpus del tema: 6 al 9 de mayo (el 10 sale del corpus del evento más unas filas propias) ----------
TT_N = {  # canal -> por día: filas, otro país, sin eje
    'Medio digital': [(110, 3, 20), (55, 3, 10), (95, 3, 17), (115, 3, 21)],
    'Instagram': [(63, 0, 1), (30, 1, 1), (46, 1, 0), (42, 0, 0)],
    'Facebook': [(15, 1, 0), (9, 0, 0), (9, 0, 0), (12, 0, 0)],
}
# X: búsqueda por eje y día con tope de 250. Figura propia llega al tope el 6 y el 9.
X_EJE = {'figura': [250, 190, 195, 250], 'fecha': [110, 105, 120, 160], 'economia': [60, 55, 55, 75], 'servicios': [30, 30, 30, 35]}
X_OP = [7, 6, 6, 8]
TOPE_X = 250
CUBRE = {'2027-05-06': (11, 18), '2027-05-09': (9, 40)}   # lo más antiguo que alcanzó la búsqueda con tope
REP_EJE = {'Medio digital': {'figura': .33, 'servicios': .17, 'fecha': .28, 'economia': .22}, 'Instagram': {'figura': .45, 'servicios': .2, 'fecha': .2, 'economia': .15},
           'Facebook': {'figura': .45, 'servicios': .15, 'fecha': .25, 'economia': .15}}
TXT_T = {
    'figura': ['Publicación de ejemplo sobre la agenda de la figura propia.', 'Publicación de ejemplo que comenta una actividad de la figura propia.',
               'Respuesta de ejemplo en una conversación sobre la figura propia.'],
    'servicios': ['Publicación de ejemplo sobre cortes de luz.', 'Publicación de ejemplo sobre el suministro de agua.', 'Publicación de ejemplo sobre el transporte público.'],
    'fecha': ['Publicación de ejemplo sobre la fecha de la elección.', 'Publicación de ejemplo sobre el cronograma electoral.'],
    'economia': ['Publicación de ejemplo sobre salarios y precios.', 'Publicación de ejemplo sobre el valor del bolívar.'],
    'sin': ['Publicación de ejemplo sobre otros temas nacionales.'],
    'op': ['Publicación de ejemplo desde otro país sobre la conversación venezolana.'],
}
TIT_T = {
    'figura': ['Nota de ejemplo sobre la agenda de la figura propia', 'Nota de ejemplo sobre una actividad de la figura propia'],
    'servicios': ['Nota de ejemplo sobre fallas del servicio eléctrico', 'Nota de ejemplo sobre el suministro de agua', 'Nota de ejemplo sobre el transporte público'],
    'fecha': ['Nota de ejemplo sobre el cronograma electoral', 'Nota de ejemplo sobre la fecha de la elección'],
    'economia': ['Nota de ejemplo sobre salarios y precios', 'Nota de ejemplo sobre el valor del bolívar'],
    'sin': ['Nota de ejemplo sobre otros temas nacionales', 'Nota de ejemplo sobre sucesos locales'],
    'op': ['Nota de ejemplo de otro país sobre la región'],
}
REC_T = {'Medio digital': lambda dia: rid('nt', dia), 'Instagram': lambda dia: rid('ig', 'cuentas', 'tema'), 'Facebook': lambda dia: rid('fb', 'paginas', 'tema')}

TEX = {}  # destacadas del tema
def tema_fila(canal, cuando, primario, otro_pais=False, sin=False, metodo='Regla', rec=None, clave=None, **kw):
    k = 'op' if otro_pais else 'sin' if sin else primario
    if canal == 'Medio digital':
        mid = mencion(canal, cuando, None, fuente=kw.pop('fuente', None) or RI.choices(FUENTES_NT, PESO_NT)[0], titulo=kw.pop('titulo', None) or RI.choice(TIT_T[k]),
                      otro_pais=otro_pais, figura='machado' if primario == 'figura' else None, sent=sent_auto() if not sin else None)
    else:
        aid = kw.pop('autor_id', None) or elegir(canal, PESOS[canal])
        tp = RI.choices(['Original', 'Respuesta', 'Cita'], [52, 40, 8])[0] if canal == 'X' and 'metricas' not in kw else 'Original'
        mid = mencion(canal, cuando, kw.pop('texto', None) or RI.choice(TXT_T[k]), autor_id=aid, tipo_pub=tp, otro_pais=otro_pais,
                      figura='machado' if primario == 'figura' else None, sent=sent_auto() if not sin else None, **kw)
    if not sin:
        eje(mid, primario, metodo, rec)
        if RI.random() < .18:
            eje(mid, RI.choice([e for e in EJES_TEMA if e != primario]), 'Regla')
    if clave: TEX[clave] = mid
    return mid

# Explícitas del tema (ejemplos por eje del informe). Cuentan dentro de los totales del día.
TEMA_EXPL = [
    ('TD1', 'X', inst('2027-05-07', 10, 12), 'figura', dict(autor_id=VOCES['analista_ejemplo_2'], texto='Publicación crítica de ejemplo sobre la agenda de la figura propia.', formato='Texto', metricas=(125000, 400, 44, 105))),
    ('TD2', 'X', inst('2027-05-06', 15, 40), 'figura', dict(autor_id=VOCES['periodista_ejemplo_2'], texto='Publicación de ejemplo con fotos de una actividad de la figura propia.', formato='Foto', metricas=(110000, 1970, 79, 725))),
    ('TD3', 'X', inst('2027-05-06', 13, 5), 'figura', dict(autor_id=A_FIG['X'], texto='Publicación de ejemplo de la cuenta oficial sobre su agenda del día.', formato='Video', metricas=(49800, 3670, 80, 1370))),
    ('TD4', 'Instagram', inst('2027-05-06', 18, 20), 'figura', dict(autor_id=A_PAR2_IG, texto='Video de ejemplo de una actividad de la figura propia con familias.', formato='Reel', metricas=(604000, 35500, 590, None))),
    ('TD5', 'Instagram', inst('2027-05-06', 20, 5), 'servicios', dict(autor_id=A_PAR1['Instagram'], texto='Video de ejemplo con un mensaje sobre servicios públicos.', formato='Reel', metricas=(210000, 34900, 1820, None))),
    ('TD6', 'Medio digital', inst('2027-05-08', 11, 30), 'servicios', dict(fuente='Portal de noticias 6', titulo='Nota de ejemplo sobre cortes de luz en varias ciudades del país')),
    ('TD7', 'Medio digital', inst('2027-05-09', 9, 15), 'fecha', dict(fuente='Diario digital 3', titulo='Nota de ejemplo sobre el cronograma de la jornada electoral')),
    ('TD8', 'X', inst('2027-05-09', 19, 30), 'fecha', dict(autor_id=VOCES['analista_ejemplo_1'], texto='Publicación de ejemplo con un análisis del calendario electoral.', formato='Texto', metricas=(37700, 2080, 28, 646))),
    ('TD9', 'Instagram', inst('2027-05-09', 21, 10), 'economia', dict(autor_id=AID('Instagram', 'portal_noticias_1'), texto='Video de ejemplo de un medio sobre precios y salarios.', formato='Reel', metricas=(186000, 8800, 1260, None))),
    ('TD10', 'Medio digital', inst('2027-05-07', 8, 45), 'economia', dict(fuente='Medio regional 4', titulo='Nota de ejemplo sobre el ajuste del salario mínimo')),
    ('TD11', 'Facebook', inst('2027-05-08', 12, 0), 'servicios', dict(autor_id=A_PAR1['Facebook'], texto='Video de ejemplo sobre el servicio de agua en una comunidad.', formato='Video', metricas=(48000, 6200, 640, 500))),
]
TEMA_N_EXPL = {}
for clave, canal, cuando, prim, kw in TEMA_EXPL:
    dia = cuando[:10]
    rec = rid('x', prim, dia) if canal == 'X' else REC_T[canal](dia)
    tema_fila(canal, cuando, prim, rec=rec, clave=clave, **kw)
    TEMA_N_EXPL[(canal, dia, prim)] = TEMA_N_EXPL.get((canal, dia, prim), 0) + 1
    TEMA_N_EXPL[(canal, dia)] = TEMA_N_EXPL.get((canal, dia), 0) + 1

for di, dia in enumerate(DT_):
    # X: por eje (búsqueda con tope). Con tope, la búsqueda (de lo más reciente hacia atrás) solo cubre desde cubre_desde.
    ops = set(RI.sample(range(sum(v[di] for v in X_EJE.values())), X_OP[di]))
    idx = 0
    for k in EJES_TEMA:
        n = X_EJE[k][di] - TEMA_N_EXPL.get(('X', dia, k), 0)
        mini = CUBRE.get(dia) if k == 'figura' else None
        pesos = [0 if mini and h < mini[0] else w for h, w in enumerate(W_BASE)]
        for cuando in instantes(dia, n, pesos, mini):
            tema_fila('X', cuando, k, otro_pais=idx in ops, metodo='Búsqueda' if RI.random() < .04 else 'Regla', rec=rid('x', k, dia))
            idx += 1
    for canal, filas in TT_N.items():
        total, op, sg = filas[di]
        n = total - TEMA_N_EXPL.get((canal, dia), 0)
        rep = dict(REP_EJE[canal])
        if di == 0: rep['figura'] *= 1.3   # el 6, día más alto de la figura
        cuandos = instantes(dia, n, W_BASE)
        for j, cuando in enumerate(cuandos):
            prim = RI.choices(list(rep), list(rep.values()))[0]
            tema_fila(canal, cuando, prim, otro_pais=j < op, sin=op <= j < op + sg,
                      metodo='Manual' if canal == 'Medio digital' and RI.random() < .1 else 'Regla', rec=REC_T[canal](dia))
# El 10: filas propias del tema que no tratan a la figura (entran en las filas recolectadas del evento, sin conversación).
for canal, (n, op, sg) in {'Medio digital': (26, 1, 4), 'Instagram': (15, 0, 0), 'Facebook': (5, 0, 0)}.items():
    for j, cuando in enumerate(instantes(DB_, n, W_BASE)):
        prim = RI.choices(['servicios', 'fecha', 'economia'], [.4, .3, .3])[0]
        tema_fila(canal, cuando, prim, otro_pais=j < op, sin=op <= j < op + sg, rec=REC_CANAL_EV[canal])

# ---------- comentarios (sin autor) ----------
FIN_EV = '2027-05-12T11:00:00-04:00'
def t2s(t):  # instante -> segundos desde 2027-05-01 00:00 hora local
    d, h = t[:10], t[11:19]
    return (date.fromisoformat(d) - date(2027, 5, 1)).days * 86400 + int(h[:2]) * 3600 + int(h[3:5]) * 60 + int(h[6:8])
def s2t(s):
    d = date(2027, 5, 1) + timedelta(days=s // 86400)
    s %= 86400
    return f'{d}T{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}{TZ}'
EMOJIS = ['👏👏👏', '🙏', '❤️❤️', '👍🇻🇪', '🙌', '💪🇻🇪', '🙏❤️']
COMS = []
def comentarios(mid, n, media_h, fin, rec):
    r = MI[mid]
    t0 = t2s(r['publicada_en'])
    lim = t2s(fin)
    vistos = []
    for _ in range(n):
        s = t0 + 60 + int(RI.expovariate(1 / (media_h * 3600)))
        if s >= lim: s = RI.randint(t0 + 60, lim - 1)
        emo = RI.random() < .15
        txt = RI.choice(EMOJIS) if emo else None
        dup = False
        if emo and RI.random() < .35: dup = True
        elif not emo and vistos and RI.random() < .05: dup = True
        c = {'id': f'inf-com-{len(COMS) + 1}', 'campana_id': CI, 'mencion_id': mid, 'canal': r['canal'], 'publicada_en': s2t(s),
             'me_gusta': int(RI.lognormvariate(.8, 1.3)), 'recoleccion_id': rec, 'solo_emojis': emo, 'duplicado': dup, 'texto': txt}
        vistos.append(c)
        COMS.append(c)
REC_COM = {c: rid('com', SL[c], 'evento') for c in ('Instagram', 'TikTok', 'YouTube', 'Facebook')}
REC_COM_T = {c: rid('com', SL[c], 'tema') for c in ('Instagram', 'Facebook')}
def conv_de(canal, dia, cat_foco, excluir=()):
    """Publicaciones generadas de un canal y día: de conversación con o sin foco, ordenadas por respuestas."""
    out = [m for m, r in MI.items() if r['canal'] == canal and r['publicada_en'][:10] == dia and EJ['conversacion'] in r['_ejes']
           and (EJ['foco'] in r['_ejes']) == cat_foco and not r['otro_pais'] and m not in excluir]
    return sorted(out, key=lambda m: (-(MI[m].get('respuestas') or 0), m))
# Instagram: 510 en 15 publicaciones (45 % en publicaciones sobre la entrevista).

fig_base = [m for m in conv_de('Instagram', DB_, False) if MI[m]['autor_id'] == A_FIG['Instagram']]
if not fig_base:   # una publicación de la cuenta de la figura el día base, con comentarios
    fig_base = [mencion('Instagram', inst(DB_, 19, 12), 'Publicación de ejemplo de la cuenta oficial sobre su agenda de la semana.', autor_id=A_FIG['Instagram'],
                        formato='Reel', metricas=(88000, 9100, 410, None), figura='machado', sent='Favorable')]
    eje(fig_base[0], 'conversacion', 'Regla', REC_CANAL_EV['Instagram'])
    eje(fig_base[0], 'figura', 'Regla', REC_CANAL_EV['Instagram'])
for mid, n in [(EVX['E2'], 95), (EVX['E5'], 70), (EVX['E6'], 25), (EVX['E7'], 20), (EVX['E8'], 8), (EVX['E9'], 12)]:
    comentarios(mid, n, 4, FIN_EV, REC_COM['Instagram'])
for lista, ns, mh in [(fig_base + conv_de('Instagram', DB_, False, fig_base), [40, 40, 30], 6), (conv_de('Instagram', DE_, False), [40, 30, 30, 20], 4),
                      (conv_de('Instagram', DP_, False), [30, 20], 2)]:
    for mid, n in zip(lista, ns):
        comentarios(mid, n, mh, FIN_EV, REC_COM['Instagram'])
# TikTok: 350 en 6 videos, 76 % en uno solo.
for mid, n in [(EVX['T1'], 266), (EVX['T2'], 30), (EVX['T3'], 24)]:
    comentarios(mid, n, 3, FIN_EV, REC_COM['TikTok'])
for mid, n in zip(conv_de('TikTok', DE_, True, (EVX['T1'], EVX['T2'], EVX['T3'])) + conv_de('TikTok', DE_, False), [12, 10, 8]):
    comentarios(mid, n, 3, FIN_EV, REC_COM['TikTok'])
comentarios(EVX['Y1'], 30, 5, FIN_EV, REC_COM['YouTube'])
# Facebook: 120 en 4 publicaciones, 93 % en dos videos.
for mid, n in [(EVX['F1'], 85), (EVX['F2'], 27), (EVX['F3'], 5), (EVX['F4'], 3)]:
    comentarios(mid, n, 3, FIN_EV, REC_COM['Facebook'])
N_COM_EV = len(COMS)
# Tema: hasta 25 comentarios de las publicaciones con más comentarios (30 de Instagram, 12 de Facebook), del 6 al 9.
FIN_T = '2027-05-09T23:59:59-04:00'
for canal, npub in (('Instagram', 30), ('Facebook', 12)):
    pubs = sorted([m for m, r in MI.items() if r['canal'] == canal and r['publicada_en'][:10] in DT_ and not r['otro_pais'] and r['_ejes']
                   and t2s(r['publicada_en']) < t2s(FIN_T) - 3600], key=lambda m: (-(MI[m].get('respuestas') or 0), m))[:npub]
    for mid in pubs:
        comentarios(mid, min(25, max(MI[mid].get('respuestas') or 0, 5)), 8, FIN_T, REC_COM_T[canal])
for c in COMS:
    add('comentarios', c)

# ---------- libros de códigos ----------
COD = {}
for libro, lista in [('General', [('apoyo', 'Apoyo o afecto', 'apoyo'), ('emojis', 'Solo emojis', 'neutro'), ('otro', 'Otro o sin tema', 'neutro'),
                                  ('elecciones', 'Elecciones y voto', 'neutro'), ('critica_fig', 'Críticas a la figura', 'critica'),
                                  ('inscripcion', 'Inscripción o participación', 'neutro'), ('critica_gob', 'Críticas al gobierno', 'critica'),
                                  ('valoracion', 'Valoración del evento', 'neutro'), ('cotidiana', 'Vida cotidiana', 'neutro'),
                                  ('defensa', 'Defensa frente a críticos', 'apoyo'), ('falla', 'Falla técnica de la transmisión', 'neutro'),
                                  ('resumen', 'Resumen de lo dicho', 'neutro')]),
                     ('Tema', [('apoyo', 'Apoyo o afecto', 'apoyo'), ('otro', 'Otro, etiquetas a cuentas o no se entiende', 'neutro'),
                               ('servicios', 'Pedidos sobre servicios públicos', 'neutro'), ('critica_fig', 'Críticas a la figura', 'critica'),
                               ('fe', 'Fe o ánimo general', 'apoyo'), ('critica_sin', 'Críticas sin destinatario claro', 'critica'),
                               ('critica_gob', 'Críticas al gobierno', 'critica'), ('caso', 'Caso personal o familiar', 'neutro'),
                               ('politica', 'Política: elecciones e instituciones', 'neutro'), ('cotidiana', 'Vida cotidiana: luz, precios, pensiones', 'neutro'),
                               ('emojis', 'Solo emojis o sin texto', 'neutro')])]:
    for o, (k, nombre, tono) in enumerate(lista, 1):
        cid_ = f'inf-cod-{libro.lower()}-{k.replace("_", "-")}'
        COD[(libro, k)] = cid_
        add('codigos', {'id': cid_, 'campana_id': CI, 'libro': libro, 'nombre': nombre, 'tono': tono, 'orden': o})
TEXTO_COD = {'apoyo': 'Comentario de ejemplo de apoyo o afecto.', 'otro': 'Comentario de ejemplo sin un tema claro.', 'elecciones': 'Comentario de ejemplo sobre las elecciones y el voto.',
             'critica_fig': 'Comentario crítico de ejemplo hacia la figura.', 'inscripcion': 'Comentario de ejemplo que pregunta cómo inscribirse o participar.',
             'critica_gob': 'Comentario de ejemplo con críticas al gobierno.', 'valoracion': 'Comentario de ejemplo que valora el evento.',
             'cotidiana': 'Comentario de ejemplo sobre la vida cotidiana.', 'defensa': 'Comentario de ejemplo que responde a otros comentarios críticos.',
             'falla': 'Comentario de ejemplo que dice que el audio de la transmisión se cortó.', 'resumen': 'Comentario de ejemplo que resume lo dicho.',
             'servicios': 'Comentario de ejemplo que pide soluciones en los servicios públicos.', 'fe': 'Comentario de ejemplo con un mensaje de fe o ánimo.',
             'critica_sin': 'Comentario crítico de ejemplo sin destinatario claro.', 'caso': 'Comentario de ejemplo sobre un caso personal o familiar.',
             'politica': 'Comentario de ejemplo sobre elecciones e instituciones.'}
for c in COMS:   # texto genérico de ejemplo para los que no quedan en una muestra
    if not c['solo_emojis']:
        c['texto'] = TEXTO_COD[RI.choices(['apoyo', 'otro', 'critica_fig', 'elecciones', 'cotidiana', 'fe'], [30, 25, 12, 10, 8, 15])[0]]

# ---------- muestras y codificaciones ----------
NCOD = {'n': 0}
def codifica(mu, sent, cod, comentario=None, mencion_=None):
    NCOD['n'] += 1
    por = 'Modelo' if RI.random() < .3 else 'Persona'
    r = {'id': f'inf-codif-{NCOD["n"]}', 'campana_id': CI, 'muestra_id': mu, 'sentimiento': sent, 'codigo_id': cod, 'codificado_por': por,
         'revisado': por == 'Persona' or RI.random() < .6}
    if comentario: r['comentario_id'] = comentario
    else: r['mencion_id'] = mencion_
    add('codificaciones', r)
def plan(n, pesos):
    """Lista de n códigos con la forma de `pesos` (mayor residuo), barajada."""
    ks = list(pesos)
    out = [k for k, c in zip(ks, reparto([pesos[k] for k in ks], n)) for _ in range(c)]
    RI.shuffle(out)
    return out
def codifica_muestra(mu, libro, items, n_sent, pesos, es_com=True):
    """items: ids muestreados. n_sent: (fav, crit, neu). Los solo emojis van a neutral con su código."""
    emo = [i for i in items if es_com and COMS_ID[i]['solo_emojis']]
    resto = [i for i in items if i not in emo]
    fav, cri, neu = n_sent
    assert fav + cri + neu == len(items) and len(emo) <= neu, (mu, len(emo), neu)
    asign = [(i, 'Neutral', 'emojis') for i in emo]
    cods = [('Favorable', k) for k in plan(fav, pesos['fav'])] + [('Desfavorable', k) for k in plan(cri, pesos['cri'])] + [('Neutral', k) for k in plan(neu - len(emo), pesos['neu'])]
    asign += [(i, s, k) for i, (s, k) in zip(resto, cods)]
    for i, s, k in asign:
        codifica(mu, s, COD[(libro, k)], comentario=i if es_com else None, mencion_=None if es_com else i)
        if es_com and k != 'emojis': COMS_ID[i]['texto'] = TEXTO_COD[k]
COMS_ID = {c['id']: c for c in COMS}
def en_periodo(c, ini, fin):
    return t2s(ini) <= t2s(c['publicada_en']) < t2s(fin)
INI_EV, INI_T, FIN_T_EXC = '2027-05-10T00:00:00-04:00', '2027-05-06T00:00:00-04:00', '2027-05-11T00:00:00-04:00'
uni_ev = {k: [c['id'] for c in COMS if c['canal'] == k and en_periodo(c, INI_EV, FIN_EV)] for k in ('YouTube', 'Instagram', 'TikTok', 'Facebook')}
TAM_EV = {'YouTube': 30, 'Instagram': 140, 'TikTok': 110, 'Facebook': 60}
SENT_EV = {'YouTube': (11, 4, 15), 'Instagram': (43, 18, 79), 'TikTok': (51, 4, 55), 'Facebook': (25, 15, 20)}
PES_EV = {
    'YouTube': {'fav': {'apoyo': 6, 'defensa': 3, 'valoracion': 2}, 'cri': {'critica_fig': 4}, 'neu': {'falla': 8, 'otro': 3, 'elecciones': 1, 'cotidiana': 1, 'critica_gob': 1}},
    'Instagram': {'fav': {'apoyo': 20, 'elecciones': 4, 'defensa': 2, 'valoracion': 3, 'inscripcion': 3}, 'cri': {'critica_fig': 12, 'otro': 2},
                  'neu': {'otro': 25, 'elecciones': 6, 'critica_gob': 6, 'cotidiana': 2, 'resumen': 3, 'inscripcion': 4, 'valoracion': 2}},
    'TikTok': {'fav': {'apoyo': 14, 'inscripcion': 6, 'elecciones': 6}, 'cri': {'critica_fig': 4}, 'neu': {'otro': 12, 'inscripcion': 18, 'elecciones': 10, 'cotidiana': 2}},
    'Facebook': {'fav': {'apoyo': 18, 'inscripcion': 3, 'elecciones': 2}, 'cri': {'critica_fig': 12, 'otro': 2}, 'neu': {'otro': 6, 'cotidiana': 2, 'elecciones': 2, 'inscripcion': 2}},
}
MU_EV = 'inf-mu-comentarios'
add('muestras', {'id': MU_EV, 'campana_id': CI, 'nombre': 'Comentarios, muestra por plataforma', 'objeto': 'comentarios', 'universo': sum(len(v) for v in uni_ev.values()),
                 'tamano': sum(TAM_EV.values()), 'semilla': '20270512', 'ponderacion': 'por volumen', 'orden': 1,
                 'metodo': 'Muestra aleatoria con semilla fija dentro de cada plataforma: todos los de YouTube y el resto en proporción al volumen. Lectura uno por uno, revisada.',
                 'estratos': [{'canal': k, 'universo': len(uni_ev[k])} for k in ('YouTube', 'Instagram', 'TikTok', 'Facebook')],
                 'extra': {'reglas': ['Los resúmenes de lo dicho cuentan como neutral.', 'Los comentarios solo con emojis cuentan como neutral.',
                                      'Una queja por una falla técnica de la transmisión cuenta como neutral.']}})
for k in ('YouTube', 'Instagram', 'TikTok', 'Facebook'):
    items = sorted(RI.sample(uni_ev[k], TAM_EV[k]), key=lambda i: int(i.rsplit('-', 1)[1]))
    codifica_muestra(MU_EV, 'General', items, SENT_EV[k], PES_EV[k])
# X: 150 publicaciones al azar entre las que tienen la marca de la entrevista o de la emisora.
uni_x = [m for m, r in MI.items() if r['canal'] == 'X' and t2s(INI_EV) <= t2s(r['publicada_en']) < t2s(FIN_EV)
         and (EJ['foco'] in r['_ejes'] or EJ['anfitrion'] in r['_ejes'])]
MU_X = 'inf-mu-x'
add('muestras', {'id': MU_X, 'campana_id': CI, 'nombre': 'Publicaciones de X', 'objeto': 'menciones', 'canal': 'X', 'universo': len(uni_x), 'tamano': 150,
                 'semilla': '20270512', 'ponderacion': 'ninguna', 'orden': 2,
                 'metodo': 'Muestra aleatoria con semilla fija entre las publicaciones de X con la marca de la entrevista o de la emisora.'})
items = sorted(RI.sample(uni_x, 150), key=lambda m: int(m.rsplit('-', 1)[1]))
codifica_muestra(MU_X, 'General', items, (40, 33, 77), {'fav': {'apoyo': 9, 'defensa': 6, 'valoracion': 15, 'elecciones': 5, 'resumen': 5},
                                                        'cri': {'critica_fig': 28, 'valoracion': 5}, 'neu': {'resumen': 38, 'otro': 30, 'critica_gob': 4, 'valoracion': 5}}, es_com=False)
# Tema: 420 comentarios de Instagram y Facebook (300 y 120), sin ponderar.
uni_t = {k: [c['id'] for c in COMS if c['canal'] == k and en_periodo(c, INI_T, FIN_T_EXC)] for k in ('Instagram', 'Facebook')}
MU_T = 'inf-mu-tema'
add('muestras', {'id': MU_T, 'campana_id': CI, 'nombre': 'Comentarios de Instagram y Facebook', 'objeto': 'comentarios', 'universo': sum(len(v) for v in uni_t.values()),
                 'tamano': 420, 'semilla': '20270511', 'ponderacion': 'ninguna', 'orden': 3,
                 'metodo': 'Hasta 25 comentarios de cada una de las publicaciones con más comentarios; 300 de Instagram y 120 de Facebook elegidos al azar. Un tema principal por comentario.',
                 'estratos': [{'canal': k, 'universo': len(uni_t[k])} for k in ('Instagram', 'Facebook')]})
for k, tam, sent, pes in [('Instagram', 300, (96, 33, 171), {'fav': {'apoyo': 39, 'fe': 18, 'politica': 6}, 'cri': {'critica_fig': 21, 'critica_sin': 10},
                                                             'neu': {'otro': 42, 'servicios': 33, 'critica_sin': 20, 'critica_gob': 18, 'caso': 18, 'politica': 6, 'cotidiana': 3}}),
                          ('Facebook', 120, (48, 24, 48), {'fav': {'apoyo': 28, 'fe': 20}, 'cri': {'critica_fig': 19, 'critica_sin': 5},
                                                           'neu': {'otro': 8, 'servicios': 8, 'critica_gob': 10, 'caso': 4, 'politica': 3}})]:
    items = sorted(RI.sample(uni_t[k], tam), key=lambda i: int(i.rsplit('-', 1)[1]))
    codifica_muestra(MU_T, 'Tema', items, sent, pes)

# ---------- recolecciones (con los conteos reales) ----------
def filas_de(canal, ini, fin):
    return sum(1 for r in MI.values() if r['canal'] == canal and t2s(ini) <= t2s(r['publicada_en']) < t2s(fin))
def recol(id_, canal, metodo, descripcion, **kw):
    r = {'id': id_, 'campana_id': CI, 'canal': canal, 'metodo': metodo, 'descripcion': descripcion}
    r.update({k: v for k, v in kw.items() if v is not None})
    add('recolecciones', r)
def eje_dia(canal, k, dia, rec):
    return sum(1 for m in T['mencion_ejes'] if m['eje_id'] == EJ[k] and m.get('recoleccion_id') == rec)
def ejec(dia, h=23, m=50):
    return inst(dia, h, m)
SIG = lambda dia: str(date.fromisoformat(dia) + timedelta(days=1))
# Evento.
recol(rid('nt', 'evento'), 'Medio digital', 'RSS', 'Agregador de noticias por RSS, edición Venezuela en español.',
      consulta='Nombre de la figura propia, entrevista, emisora anfitriona y su programa (términos de ejemplo).', periodo_inicio=INI_EV, periodo_fin=FIN_EV,
      ejecutada_en=inst(DP_, 11, 20), filas=filas_de('Medio digital', INI_EV, FIN_EV), pedidas=4, leidas=4,
      limites=['Las marcas leen solo el titular.', 'La hora es la que da el agregador; puede ser posterior a la publicación original.'])
for dia, fin in ((DB_, inst(DE_, 0, 0)), (DE_, inst(DP_, 0, 0)), (DP_, FIN_EV)):
    recol(rid('x', dia), 'X', 'Búsqueda avanzada', 'Búsqueda en español sobre la figura propia, la entrevista y la emisora, sin reposts.',
          consulta='(figura propia OR entrevista OR emisora anfitriona) lang:es -is:retweet', eje_id=EJ['conversacion'], dia=dia,
          periodo_inicio=inst(dia, 0, 0), periodo_fin=fin, ejecutada_en=inst(DP_, 11, 30), filas=filas_de('X', inst(dia, 0, 0), fin), tope=1500, llego_al_tope=False,
          pedidas=1, leidas=1, limites=['Solo publicaciones en español.', 'Sin reposts.', 'Tope de 1.500 publicaciones por búsqueda y por día.'])
recol(rid('x', 'foco'), 'X', 'Búsqueda avanzada', 'Búsqueda de la marca de la entrevista o de la emisora junto a la figura propia.',
      consulta='(entrevista OR emisora anfitriona) figura propia lang:es -is:retweet', eje_id=EJ['foco'], dia=DE_, periodo_inicio=inst(DE_, 0, 0), periodo_fin=inst(DP_, 0, 0),
      ejecutada_en=inst(DP_, 11, 35), filas=eje_dia('X', 'foco', DE_, rid('x', 'foco')), tope=1500, llego_al_tope=False, pedidas=1, leidas=1,
      limites=['Puede incluir otras entrevistas o dejar fuera publicaciones que no nombran la entrevista.'])
recol(rid('ig', 'cuentas', 'evento'), 'Instagram', 'Cuentas', 'Cuentas de la emisora, de la figura, de partidos y de medios.', periodo_inicio=INI_EV, periodo_fin=FIN_EV,
      ejecutada_en=inst(DP_, 11, 40), filas=filas_de('Instagram', INI_EV, FIN_EV) - 6, pedidas=14, leidas=12,
      faltantes=[{'cuenta': '@portal_noticias_5', 'motivo': 'La cuenta no devolvió datos.'}, {'cuenta': '@medio_regional_2', 'motivo': 'Cuenta no encontrada.'}],
      limites=['Máximo de 3 páginas de publicaciones por cuenta.', 'Las fotos no informan visualizaciones.'])
recol(rid('ig', 'etiquetas', 'evento'), 'Instagram', 'Etiquetas', 'Cuatro etiquetas de ejemplo sobre la entrevista y la figura.',
      consulta='#entrevista_ejemplo, #emisora_ejemplo, #figura_ejemplo, #programa_ejemplo', periodo_inicio=INI_EV, periodo_fin=FIN_EV, ejecutada_en=inst(DP_, 11, 42),
      filas=6, pedidas=4, leidas=4, limites=['Las etiquetas devuelven solo las publicaciones más recientes.'])
recol(rid('tt', 'palabras', 'evento'), 'TikTok', 'Búsqueda por palabras', 'Búsqueda por palabras sobre la figura propia y la entrevista.',
      consulta='figura propia entrevista; figura propia emisora; entrevista radial; programa de ejemplo', periodo_inicio=INI_EV, periodo_fin=FIN_EV,
      ejecutada_en=inst(DP_, 11, 45), filas=filas_de('TikTok', INI_EV, FIN_EV) - 20, tope=400, llego_al_tope=False, pedidas=4, leidas=4,
      limites=['Ventana de 7 días.', '5 páginas de 20 videos por consulta.', '4 consultas.'])
recol(rid('tt', 'cuentas', 'evento'), 'TikTok', 'Cuentas', 'Cuentas de la emisora y del partido.', periodo_inicio=INI_EV, periodo_fin=FIN_EV,
      ejecutada_en=inst(DP_, 11, 47), filas=20, pedidas=3, leidas=3, limites=['Los clips automáticos del en vivo llevan un texto genérico.'])
recol(rid('yt', 'cuentas', 'evento'), 'YouTube', 'Cuentas', 'Canal de la emisora anfitriona.', periodo_inicio=INI_EV, periodo_fin=FIN_EV, ejecutada_en=inst(DP_, 11, 50),
      filas=10, pedidas=1, leidas=1, limites=['El video del programa aparece con la hora de la transmisión.'])
recol(rid('yt', 'palabras', 'evento'), 'YouTube', 'Búsqueda por palabras', 'Búsqueda por palabras sobre la entrevista.', consulta='entrevista radial figura propia',
      periodo_inicio=INI_EV, periodo_fin=FIN_EV, ejecutada_en=inst(DP_, 11, 52), filas=filas_de('YouTube', INI_EV, FIN_EV) - 10, pedidas=1, leidas=1,
      limites=['No se encontró una copia completa subida por otras cuentas.'])
recol(rid('fb', 'paginas', 'evento'), 'Facebook', 'Páginas', 'Páginas públicas del partido y de seis medios, leídas sin iniciar sesión.', periodo_inicio=INI_EV, periodo_fin=FIN_EV,
      ejecutada_en=inst(DP_, 11, 55), filas=filas_de('Facebook', INI_EV, FIN_EV), pedidas=9, leidas=7,
      faltantes=[{'cuenta': 'Página de la figura propia', 'motivo': 'La página no devolvió datos.'},
                 {'cuenta': 'Página de la emisora anfitriona', 'motivo': 'No se encontró una página pública.'}],
      limites=['Las 60 a 130 publicaciones más recientes de cada página.', 'Solo los videos informan visualizaciones.', 'Las fechas llegan en UTC y se pasan a hora de Caracas.'])
for canal, desc, metodo, tope, lim in [
        ('Instagram', 'Comentarios de las publicaciones elegidas.', 'Cuentas', 100, ['Tope del proveedor por publicación; es probable que falten las respuestas.']),
        ('TikTok', 'Comentarios de los videos elegidos.', 'Búsqueda por palabras', 300, ['Tope del proveedor por video.']),
        ('YouTube', 'Comentarios del video de la emisora.', 'Cuentas', None, ['Se recolectaron todos los comentarios del video.']),
        ('Facebook', 'Comentarios de cuatro publicaciones sobre la entrevista.', 'Páginas', 100, ['Máximo de 100 comentarios por publicación.'])]:
    filas_c = sum(1 for c in COMS[:N_COM_EV] if c['canal'] == canal)
    pubs = len({c['mencion_id'] for c in COMS[:N_COM_EV] if c['canal'] == canal})
    falt = [{'cuenta': 'Video principal de la página del partido', 'motivo': f'El proveedor devolvió 85 de {MI[EVX["F1"]]["respuestas"]:,} comentarios.'.replace(',', '.')}] if canal == 'Facebook' else []
    recol(REC_COM[canal], canal, metodo, desc, periodo_inicio=INI_EV, periodo_fin=FIN_EV, ejecutada_en=inst(DP_, 12, 10), filas=filas_c, tope=tope,
          llego_al_tope=canal == 'Facebook', pedidas=pubs, leidas=pubs, faltantes=falt, limites=lim, extra={'objeto': 'comentarios'})
# Tema (6 al 9; el 10 lo cubren las recolecciones del evento).
for dia in DT_:
    recol(rid('nt', dia), 'Medio digital', 'RSS', 'Agregador de noticias por RSS, edición Venezuela en español, 11 consultas por día.',
          consulta='Términos de los cuatro ejes (ejemplo).', dia=dia, periodo_inicio=inst(dia, 0, 0), periodo_fin=inst(SIG(dia), 0, 0), ejecutada_en=inst(SIG(dia), 6, 0),
          filas=filas_de('Medio digital', inst(dia, 0, 0), inst(SIG(dia), 0, 0)), pedidas=11, leidas=11, limites=['Los ejes se asignan solo por el titular.'])
    for k in EJES_TEMA:
        rr = rid('x', k, dia)
        n = eje_dia('X', k, dia, rr)
        tope = n >= TOPE_X
        cub = inst(dia, *CUBRE[dia]) if tope else None
        est = round(n * 24 * 60 / (24 * 60 - CUBRE[dia][0] * 60 - CUBRE[dia][1])) if tope else None
        recol(rr, 'X', 'Búsqueda avanzada', f'Búsqueda en español del eje {next(e["nombre"] for e in T["ejes"] if e["id"] == EJ[k])}, ordenada por las más recientes.',
              consulta=f'(términos del eje {k}) lang:es -is:retweet', eje_id=EJ[k], dia=dia, periodo_inicio=inst(dia, 0, 0), periodo_fin=inst(SIG(dia), 0, 0),
              cubre_desde=cub, ejecutada_en=inst(SIG(dia), 6, 30), filas=n, tope=TOPE_X, llego_al_tope=tope, estimado=est, pedidas=1, leidas=1,
              limites=['Tope de 250 publicaciones por eje y por día.', 'Con tope, el estimado del día completo supone un ritmo parejo de publicación.'] if tope else ['Tope de 250 publicaciones por eje y por día.'])
recol(rid('ig', 'cuentas', 'tema'), 'Instagram', 'Cuentas', '30 cuentas de prensa, política y organizaciones.', periodo_inicio=INI_T, periodo_fin=INI_EV, ejecutada_en=inst(DB_, 7, 0),
      filas=filas_de('Instagram', INI_T, INI_EV) - 12, pedidas=30, leidas=28,
      faltantes=[{'cuenta': '@portal_noticias_7', 'motivo': 'La cuenta no devolvió datos.'}, {'cuenta': '@organizacion_ejemplo_1', 'motivo': 'Cuenta privada.'}],
      limites=['Máximo de publicaciones por cuenta: a 9 cuentas les faltan sus días más antiguos.', 'Solo se guardaron publicaciones con algún eje.'],
      extra={'cuentas_al_limite': 9})
recol(rid('ig', 'etiquetas', 'tema'), 'Instagram', 'Etiquetas', 'Seis etiquetas de ejemplo de los cuatro ejes.',
      consulta='#eje_ejemplo_1, #eje_ejemplo_2, #eje_ejemplo_3, #eje_ejemplo_4, #eje_ejemplo_5, #eje_ejemplo_6', periodo_inicio=INI_T, periodo_fin=INI_EV,
      ejecutada_en=inst(DB_, 7, 5), filas=12, pedidas=6, leidas=6, limites=['Las etiquetas devuelven solo las publicaciones más recientes.'])
recol(rid('fb', 'paginas', 'tema'), 'Facebook', 'Páginas', 'Páginas públicas de un partido y de nueve medios.', periodo_inicio=INI_T, periodo_fin=INI_EV, ejecutada_en=inst(DB_, 7, 10),
      filas=filas_de('Facebook', INI_T, INI_EV), pedidas=10, leidas=8,
      faltantes=[{'cuenta': 'Página de la figura propia', 'motivo': 'La página no devolvió datos.'},
                 {'cuenta': 'Página de una organización de ejemplo', 'motivo': 'La página no devolvió datos.'},
                 {'cuenta': '@portal_noticias_3', 'motivo': 'Faltan los días más antiguos.', 'desde': inst('2027-05-07', 14, 0)}],
      limites=['Solo publicaciones con algún eje, con el texto de la publicación o el título del enlace.'])
for canal, desc, metodo in [('Instagram', 'Comentarios: los 25 más recientes de las 30 publicaciones con más comentarios.', 'Cuentas'),
                            ('Facebook', 'Comentarios: hasta 25 de las 12 publicaciones con más comentarios, en el orden que devuelve la página.', 'Páginas')]:
    lst = [c for c in COMS[N_COM_EV:] if c['canal'] == canal]
    pubs = len({c['mencion_id'] for c in lst})
    recol(REC_COM_T[canal], canal, metodo, desc, periodo_inicio=INI_T, periodo_fin=INI_EV, ejecutada_en=inst(DB_, 8, 0), filas=len(lst), tope=25 * pubs,
          llego_al_tope=False, pedidas=pubs, leidas=pubs, limites=['Hasta 25 comentarios por publicación: no mide el volumen diario de comentarios.'],
          extra={'objeto': 'comentarios'})

# ---------- reportes de tipo Informe ----------
SECS_EV = ['resumen', 'volumen', 'alcance', 'reparto', 'sentimiento', 'publicaciones', 'medios', 'comparacion', 'metodologia']
SECS_T = ['resumen', 'volumen', 'ejes', 'medios', 'publicaciones', 'sentimiento', 'metodologia']
def dest_(clave_mid, resumen, etiqueta=None, eje_k=None, grupo=None):
    d = {'mencion_id': clave_mid, 'resumen': resumen}
    if etiqueta: d['etiqueta'] = etiqueta
    if eje_k: d['eje_id'] = EJ[eje_k]
    if grupo: d['grupo'] = grupo
    return d
INF_EV = {
    'modo': 'evento', 'zona': 'America/Caracas', 'periodo_inicio': INI_EV, 'periodo_fin': FIN_EV, 'dia_base': DB_, 'dia_evento': DE_, 'evento_id': EV_INF,
    'ventana_evento': {'inicio': inst(DE_, 8, 30), 'fin': inst(DE_, 9, 15), 'estimada': True},
    'eje_conversacion': EJ['conversacion'], 'eje_foco': EJ['foco'], 'comparacion': {'eje_id': EJ['anfitrion'], 'etiqueta': 'Nombra al medio anfitrión'},
    'muestras': [MU_EV, MU_X], 'libro': 'General', 'ambito_rankings': 'foco',
    'enmascarar': {'top_publicaciones': 'agrupar', 'top_cuentas': 'agrupar', 'destacadas': 'agrupar'},
    'cuentas_propias': [A_EMI['Instagram'], A_EMI['TikTok'], A_EMI['YouTube'], A_EMI['X']],
    'destacadas': [
        dest_(EVX['E1'], 'Anuncio de la entrevista, publicado la noche anterior a las 20:00 (ejemplo).', grupo='propias'),
        dest_(EVX['E2'], 'Clip con la figura, publicado junto con su cuenta (ejemplo).', grupo='propias'),
        dest_(EVX['E3'], 'Publicación sobre el invitado del programa (ejemplo).', grupo='propias'),
        dest_(EVX['E4'], 'Nota de la emisora del día siguiente, 07:00 (ejemplo).', grupo='propias'),
        dest_(EVX['Y1'], 'Video del programa con la entrevista, 44 minutos, fechado a las 09:18 (ejemplo).', grupo='propias'),
        dest_(EVX['T4'], 'Clip automático del en vivo. El texto no nombra la entrevista (ejemplo).', grupo='propias'),
        dest_(EVX['T5'], 'Clip automático del en vivo. El texto no nombra la entrevista (ejemplo).', grupo='propias'),
        dest_(EVX['X2'], 'Un periodista anuncia la entrevista en curso y nombra a la emisora (ejemplo).'),
        dest_(EVX['X1'], 'Una cuenta personal resume un tema de la entrevista. Es la publicación de X con más vistas (ejemplo).'),
        dest_(EVX['F1'], 'Video del partido con fragmentos de la entrevista. Reúne casi todas las vistas de Facebook (ejemplo).'),
        dest_(EVX['E5'], 'Video del partido con fragmentos de la entrevista (ejemplo).'),
        dest_(EVX['T1'], 'Video del partido sobre el registro para votar; concentra los comentarios de TikTok (ejemplo).'),
        dest_(EVX['X8'], 'Un analista cuestiona el formato de la entrevista. Es una de las voces críticas con más vistas (ejemplo).', etiqueta='Crítica'),
    ],
    'titulo': 'Informe de impacto: entrevista radial de ejemplo', 'subtitulo': 'Programa de ejemplo, martes 11 de mayo de 2027',
    'nota_portada': 'Edición de ejemplo. Las cifras son inventadas y la recolección se limitó a propósito para mostrar el tipo de análisis.',
    'nota_version': 'Versión 2: se agrega Facebook.', 'fecha_informe': DP_,
    'secciones': [{'id': s, 'activa': True, 'texto': ''} for s in SECS_EV],
}
INF_T = {
    'modo': 'tema', 'zona': 'America/Caracas', 'periodo_inicio': '2027-05-06', 'periodo_fin': '2027-05-10',
    'ejes': [EJ[k] for k in EJES_TEMA], 'canales': ['Medio digital', 'X', 'Instagram', 'Facebook'], 'muestras': [MU_T], 'libro': 'Tema', 'ambito_rankings': 'ejes',
    'enmascarar': {'top_publicaciones': 'agrupar', 'top_cuentas': 'omitir', 'destacadas': 'agrupar'}, 'limites': {'cuentas': 10, 'medios': 10},
    'destacadas': [
        dest_(TEX['TD3'], 'Publicación de la cuenta oficial sobre su agenda del día (ejemplo).', eje_k='figura'),
        dest_(TEX['TD2'], 'Un fotoperiodista publica fotos de una actividad de la figura (ejemplo).', eje_k='figura'),
        dest_(TEX['TD4'], 'Video de una actividad con familias. Es la publicación de Instagram con más reproducciones (ejemplo).', eje_k='figura'),
        dest_(TEX['TD1'], 'Un analista cuestiona la agenda de la figura. Es una de las voces críticas con más vistas (ejemplo).', etiqueta='Crítica', eje_k='figura'),
        dest_(TEX['TD5'], 'Video del partido con un mensaje sobre servicios públicos (ejemplo).', eje_k='servicios'),
        dest_(TEX['TD6'], 'Nota sobre cortes de luz en varias ciudades (ejemplo).', eje_k='servicios'),
        dest_(TEX['TD11'], 'Video sobre el servicio de agua en una comunidad (ejemplo).', eje_k='servicios'),
        dest_(TEX['TD7'], 'Nota sobre el cronograma de la jornada electoral (ejemplo).', eje_k='fecha'),
        dest_(TEX['TD8'], 'Un analista resume el calendario electoral (ejemplo).', eje_k='fecha'),
        dest_(TEX['TD10'], 'Nota sobre el ajuste del salario mínimo (ejemplo).', eje_k='economia'),
        dest_(TEX['TD9'], 'Video de un medio sobre precios y salarios (ejemplo).', eje_k='economia'),
    ],
    'titulo': 'Informe de conversación: cuatro ejes de ejemplo', 'subtitulo': '6 al 10 de mayo de 2027',
    'nota_portada': 'Edición de ejemplo con cifras inventadas. Fuentes: noticias en línea, X, Instagram y Facebook.',
    'nota_version': 'Versión 2: se agrega Facebook.', 'fecha_informe': DP_,
    'secciones': [{'id': s, 'activa': s in SECS_T, 'texto': ''} for s in SECS_T + ['alcance', 'reparto', 'comparacion']],
}
for o, (rid_, nombre, ev, cfg, desc) in enumerate([
        ('inf-rep-evento', 'Informe de impacto · Entrevista radial (ejemplo)', EV_INF, INF_EV, 'Impacto de la entrevista radial del 11 de mayo: día base, día del evento y mañana siguiente.'),
        ('inf-rep-tema', 'Informe de conversación · Cuatro ejes (ejemplo)', None, INF_T, 'Conversación del 6 al 10 de mayo en cuatro ejes, en noticias, X, Instagram y Facebook.')], 1):
    r = {'id': rid_, 'campana_id': CI, 'nombre': nombre, 'tipo': 'Informe', 'frecuencia': 'Una vez', 'formato': 'PDF', 'estado': 'Activo',
         'requiere_aprobacion': True, 'orden': o, 'extra': {'descripcion': desc, 'marca': 'Consultora', 'confidencial': True, 'informe': cfg}}
    if ev: r['evento_id'] = ev
    add('reportes', r)

# Comprobaciones de las reglas de contenido del Informe.
for a in T['autores']:
    if a['campana_id'] == CI:
        assert a['handle'].startswith('@') and all(x not in a['handle'] for x in ('vente', 'rumbos', 'machado')), a['handle']
        if a['tipo'] == 'Cuenta personal': assert (a.get('seguidores') or 0) < 100000, a['handle']
for m in T['menciones']:
    if m['campana_id'] == CI:
        assert 'ejemplo' in (m.get('titulo') or '') and '"' not in (m.get('titulo') or '') and '“' not in (m.get('titulo') or ''), m['id']
        if m['canal'] == 'Medio digital': assert not any(m.get(k) for k in ('vistas', 'me_gusta', 'respuestas', 'compartidos')), m['id']
        if m.get('vistas') is not None: assert m['canal'] == 'X' or m['formato'] in ('Video', 'Reel', 'En vivo'), m['id']

# ====================================================================
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.json'):
        os.remove(os.path.join(OUT, f))
for tabla, filas in T.items():
    with open(os.path.join(OUT, f'{tabla}.json'), 'w', encoding='utf-8') as fh:
        json.dump(filas, fh, ensure_ascii=False, indent=1)
for tabla in sorted(T):
    print(f'{tabla}: {len(T[tabla])}')
