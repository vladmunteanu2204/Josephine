"""
josephine_answers.py — localized Layer-2 (structured_answer) replies in EN/IT/DE.

structured_answer() keeps all its keyword/control-flow logic; it just pulls the
reply TEXT from here via answer(key, lang, q, **vars). Voice: Josephine's warm
first person; IT = "tu", DE = "du" (informal). Numbers / phone codes / units are
kept EXACT across languages (118, 112, SPF 50, 2L, 6°C/1000m).

SAFETY NOTE: the emergency / altitude / navigation / weather-gear / technical
keys carry life-safety guidance. The IT/DE here are careful translations but
should still get a native-speaker review before launch.

Missing language → falls back to EN, so partial coverage never breaks anything.
"""

import hashlib


def _pick(variants, q=''):
    """Stable variant selection (same question → same variant within a session)."""
    if not variants:
        return ''
    if len(variants) == 1 or not q:
        return variants[0]
    idx = int(hashlib.sha256(q.lower().strip().encode()).hexdigest(), 16) % len(variants)
    return variants[idx]


def answer(key, lang='en', q='', **variables):
    """Return the localized reply for `key`, or None if the key is unknown."""
    entry = ANSWERS.get(key)
    if not entry:
        return None
    variants = entry.get((lang or 'en')[:2]) or entry.get('en')
    if not variants:
        return None
    text = _pick(variants, q)
    for k, v in variables.items():
        text = text.replace('{' + k + '}', str(v))
    return text


# ── Localizers for data fragments injected into entity-templated answers ─────
# Months and difficulty/level enums come from the data in English; these map the
# known values to IT/DE. Unknown values pass through unchanged (never fabricate).
_MONTHS = {
    'January':   {'it': 'gennaio',   'de': 'Januar'},
    'February':  {'it': 'febbraio',  'de': 'Februar'},
    'March':     {'it': 'marzo',     'de': 'März'},
    'April':     {'it': 'aprile',    'de': 'April'},
    'May':       {'it': 'maggio',    'de': 'Mai'},
    'June':      {'it': 'giugno',    'de': 'Juni'},
    'July':      {'it': 'luglio',    'de': 'Juli'},
    'August':    {'it': 'agosto',    'de': 'August'},
    'September': {'it': 'settembre', 'de': 'September'},
    'October':   {'it': 'ottobre',   'de': 'Oktober'},
    'November':  {'it': 'novembre',  'de': 'November'},
    'December':  {'it': 'dicembre',  'de': 'Dezember'},
}
_ENUM = {
    'easy':       {'it': 'facile',      'de': 'leicht'},
    'moderate':   {'it': 'moderata',    'de': 'mäßig'},
    'medium':     {'it': 'media',       'de': 'mittel'},
    'hard':       {'it': 'difficile',   'de': 'schwer'},
    'difficult':  {'it': 'difficile',   'de': 'schwierig'},
    'challenging':{'it': 'impegnativa', 'de': 'anspruchsvoll'},
    'expert':     {'it': 'per esperti', 'de': 'für Experten'},
    'low':        {'it': 'bassa',       'de': 'niedrig'},
    'high':       {'it': 'alta',        'de': 'hoch'},
    'unknown':    {'it': 'non nota',    'de': 'non nota'},
}


def loc_month(name, lang):
    lg = (lang or 'en')[:2]
    if lg in ('it', 'de'):
        return _MONTHS.get(name, {}).get(lg, name)
    return name


def loc_months(names, lang):
    return ', '.join(loc_month(n, lang) for n in (names or []))


def loc_enum(word, lang):
    if not word:
        return word
    lg = (lang or 'en')[:2]
    if lg in ('it', 'de'):
        m = _ENUM.get(str(word).strip().lower())
        if m:
            return m.get(lg, word)
    return word


def day_word(n, lang):
    lg = (lang or 'en')[:2]
    if lg == 'it':
        return 'giorno' if n == 1 else 'giorni'
    if lg == 'de':
        return 'Tag' if n == 1 else 'Tage'
    return 'day' if n == 1 else 'days'


ANSWERS = {
    # ── Weather-gear (SAFETY) ────────────────────────────────────────────────
    'wxGearRain': {
        'en': ["Rain in these mountains is serious — pack a proper waterproof shell (not just water-resistant), and waterproof your boots or bring gaiters. Wet limestone is as slippery as ice, so trekking poles help a lot. Layer underneath the shell because it'll be cold too. If there's a storm risk, be off any exposed ridge or via ferrata by 13:00 — lightning up here is the main danger and it moves fast. Keep an eye on the south sky."],
        'it': ["La pioggia in montagna è una cosa seria — porta una giacca davvero impermeabile (non solo idrorepellente) e impermeabilizza gli scarponi o porta le ghette. La roccia calcarea bagnata è scivolosa come il ghiaccio, quindi i bastoncini aiutano molto. Vesti a strati sotto la giacca, perché farà anche freddo. Se c'è rischio di temporali, scendi da creste esposte o vie ferrate entro le 13:00 — i fulmini quassù sono il pericolo principale e arrivano in fretta. Tieni d'occhio il cielo a sud."],
        'de': ["Regen in diesen Bergen ist ernst zu nehmen — pack eine richtige wasserdichte Jacke ein (nicht nur wasserabweisend) und imprägniere deine Schuhe oder nimm Gamaschen mit. Nasser Kalkfels ist so rutschig wie Eis, daher helfen Stöcke sehr. Zieh unter der Jacke Schichten an, denn es wird auch kalt. Bei Gewittergefahr sei bis 13:00 von jedem exponierten Grat oder Klettersteig herunter — Blitze sind hier oben die Hauptgefahr und ziehen schnell auf. Behalte den südlichen Himmel im Auge."],
    },
    'wxGearSun': {
        'en': ["High-altitude sun is stronger than it looks — the thin high-altitude air lets through far more UV than you'd expect. SPF 50 is not overkill, especially above 2000m. Polarised sunglasses help on the pale rock. Bring at least 2L of water (3L on a hard trail), and if it's above 25°C start early or head straight to altitude where it stays cooler. A thin packable layer still belongs in your bag — the summit will always be colder than the valley."],
        'it': ["Il sole in quota è più forte di quanto sembri — l'aria rarefatta in quota lascia passare molti più raggi UV di quanto immagini. La protezione 50 non è esagerata, soprattutto sopra i 2000 m. Gli occhiali da sole polarizzati aiutano sulla roccia chiara. Porta almeno 2L d'acqua (3L su un percorso impegnativo) e, se supera i 25°C, parti presto o sali subito in quota dove resta più fresco. Uno strato leggero e comprimibile va comunque messo nello zaino — la cima sarà sempre più fredda della valle."],
        'de': ["Die Sonne in der Höhe ist stärker, als sie aussieht — die dünne Höhenluft lässt weit mehr UV durch, als man erwartet. LSF 50 ist nicht übertrieben, vor allem über 2000 m. Polarisierte Sonnenbrillen helfen auf dem hellen Fels. Nimm mindestens 2L Wasser mit (3L auf einer schweren Tour), und bei über 25°C starte früh oder geh gleich in die Höhe, wo es kühler bleibt. Eine dünne, packbare Schicht gehört trotzdem in den Rucksack — der Gipfel ist immer kälter als das Tal."],
    },
    'wxGearWind': {
        'en': ["Wind on the high ridges can be sudden and strong. A windproof outer shell — even a lightweight running jacket — makes a huge difference. Secure your hat, and if gusts are above 40 km/h I'd avoid narrow exposed ridges and via ferratas. You'll feel the wind chill mainly on the return, so keep a layer accessible."],
        'it': ["Il vento sulle creste in quota può essere improvviso e forte. Una giacca antivento — anche una leggera da running — fa una grande differenza. Fissa bene il cappello e, se le raffiche superano i 40 km/h, eviterei creste strette ed esposte e le vie ferrate. Sentirai il freddo del vento soprattutto al ritorno, quindi tieni uno strato a portata di mano."],
        'de': ["Wind auf den Höhengraten kann plötzlich und stark sein. Eine winddichte Außenjacke — selbst eine leichte Laufjacke — macht einen riesigen Unterschied. Sichere deine Mütze, und bei Böen über 40 km/h würde ich schmale, exponierte Grate und Klettersteige meiden. Die Windkälte spürst du vor allem am Rückweg, halte also eine Schicht griffbereit."],
    },
    'wxGearFog': {
        'en': ["Fog is mainly a navigation issue — download an offline GPS track or take a paper map. The CAI waymarks are good but low cloud can hide them. Dress for cold and damp: fog feels colder than the thermometer says. A waterproof shell and warm mid-layer are the kit. If you're heading to altitude and the cloud won't lift, a lower-route alternative is worth having."],
        'it': ["La nebbia è soprattutto un problema di orientamento — scarica una traccia GPS offline o porta una mappa cartacea. I segnavia CAI sono buoni, ma le nubi basse possono nasconderli. Vestiti per il freddo e l'umidità: con la nebbia si sente più freddo di quanto dica il termometro. Giacca impermeabile e un caldo strato intermedio sono l'attrezzatura giusta. Se sali in quota e le nubi non si alzano, è bene avere un'alternativa a quota più bassa."],
        'de': ["Nebel ist vor allem ein Orientierungsproblem — lade einen Offline-GPS-Track herunter oder nimm eine Papierkarte mit. Die CAI-Markierungen sind gut, aber tiefe Wolken können sie verdecken. Kleide dich für Kälte und Nässe: Nebel fühlt sich kälter an, als das Thermometer sagt. Wasserdichte Jacke und eine warme Zwischenschicht sind die Ausrüstung. Wenn du in die Höhe willst und sich die Wolken nicht heben, lohnt sich eine Alternative in tieferer Lage."],
    },
    'wxGearSnow': {
        'en': ["On snow or ice above 1500m: microspikes (for hard packed snow) or snowshoes (for deep snow), trekking poles, warm base layer + mid layer + waterproof shell. Never trust a summer trail description in winter — the route may be completely different. Tell someone your plan and expected return time before you go."],
        'it': ["Su neve o ghiaccio sopra i 1500 m: ramponcini (per neve dura e compatta) o ciaspole (per neve fonda), bastoncini, strato base caldo + strato intermedio + giacca impermeabile. In inverno non fidarti mai della descrizione estiva di un sentiero — il percorso può essere completamente diverso. Prima di partire, di' a qualcuno il tuo piano e l'orario di rientro previsto."],
        'de': ["Auf Schnee oder Eis über 1500 m: Grödel (für harten, festen Schnee) oder Schneeschuhe (für Tiefschnee), Stöcke, warme Basisschicht + Zwischenschicht + wasserdichte Jacke. Vertraue im Winter nie einer Sommer-Wegbeschreibung — die Route kann ganz anders sein. Sag jemandem vor dem Aufbruch deinen Plan und die voraussichtliche Rückkehrzeit."],
    },
    'wxGearGeneric': {
        'en': ["It depends what the sky is doing. In short: rain → proper waterproof shell and non-slip boots; sun → SPF 50, sunglasses, 2L of water minimum; wind → windproof layer; fog → offline GPS track and warm clothes. Whatever the weather, a thin packable layer and sunscreen belong in every pack — conditions up here can flip in 30 minutes."],
        'it': ["Dipende da cosa fa il cielo. In breve: pioggia → giacca davvero impermeabile e scarponi antiscivolo; sole → protezione 50, occhiali da sole, almeno 2L d'acqua; vento → strato antivento; nebbia → traccia GPS offline e vestiti caldi. Qualunque sia il tempo, uno strato leggero comprimibile e la crema solare vanno in ogni zaino — in montagna le condizioni possono cambiare in 30 minuti."],
        'de': ["Es kommt darauf an, was der Himmel macht. Kurz: Regen → richtige wasserdichte Jacke und rutschfeste Schuhe; Sonne → LSF 50, Sonnenbrille, mindestens 2L Wasser; Wind → winddichte Schicht; Nebel → Offline-GPS-Track und warme Kleidung. Bei jedem Wetter gehören eine dünne packbare Schicht und Sonnencreme in jeden Rucksack — in den Bergen kann das Wetter in 30 Minuten umschlagen."],
    },
    'wxNoLive': {
        'en': ["I can't pull live weather from here, but the weather tab shows the current forecast and a 7-day outlook for any trail coordinates. Check it before you head out!"],
        'it': ["Da qui non riesco a recuperare il meteo in tempo reale, ma la scheda meteo mostra le previsioni attuali e una panoramica a 7 giorni per le coordinate di qualsiasi sentiero. Controllala prima di partire!"],
        'de': ["Live-Wetter kann ich von hier nicht abrufen, aber der Wetter-Tab zeigt die aktuelle Vorhersage und einen 7-Tage-Ausblick für die Koordinaten jedes Wegs. Schau vor dem Aufbruch rein!"],
    },

    # ── Gear ─────────────────────────────────────────────────────────────────
    'gearEasy': {
        'en': ["For an easy trail, walking shoes or light trail runners are fine — no need for heavy boots. Bring 1.5L of water, sunscreen (Alpine UV is intense even on overcast days), and a light jacket for the return. That's genuinely all you need."],
        'it': ["Per un sentiero facile vanno bene scarpe da passeggio o leggere trail runner — niente scarponi pesanti. Porta 1,5L d'acqua, crema solare (i raggi UV alpini sono intensi anche con il cielo coperto) e una giacca leggera per il ritorno. È davvero tutto ciò che serve."],
        'de': ["Für einen leichten Weg reichen Wanderschuhe oder leichte Trailrunner — keine schweren Stiefel nötig. Nimm 1,5L Wasser, Sonnencreme (die alpine UV-Strahlung ist selbst bei bedecktem Himmel intensiv) und eine leichte Jacke für den Rückweg. Das ist wirklich alles, was du brauchst."],
    },
    'gearHard': {
        'en': ["For hard or alpine routes, stiff mountain boots are non-negotiable — Alpine scree will destroy trail runners. Carry 3L of water, a full rain layer, first-aid kit, an emergency thermal blanket, and download the GPS track before leaving (no signal above 1600m usually). Via ferrata routes also need a harness and lanyard."],
        'it': ["Per percorsi impegnativi o alpini, gli scarponi rigidi da montagna sono irrinunciabili — i ghiaioni alpini distruggono le trail runner. Porta 3L d'acqua, una giacca antipioggia completa, un kit di primo soccorso, una coperta termica d'emergenza, e scarica la traccia GPS prima di partire (di solito niente segnale sopra i 1600 m). Le vie ferrate richiedono anche imbrago e set da ferrata."],
        'de': ["Für schwere oder alpine Touren sind steife Bergstiefel Pflicht — Alpiner Schotter zerstört Trailrunner. Nimm 3L Wasser, eine vollwertige Regenschicht, ein Erste-Hilfe-Set, eine Rettungsdecke mit und lade den GPS-Track vor dem Start herunter (über 1600 m meist kein Empfang). Klettersteige brauchen zusätzlich Gurt und Klettersteigset."],
    },
    'gearMedium': {
        'en': [
            "For a medium hike the most important thing is hiking boots with ankle support — the rocky alpine scree demands it. Pack 2L of water, a rain layer (afternoon thunderstorms are common June–August, aim to be below the treeline by 1pm), a snack, and sunscreen. Trekking poles help significantly on the descent. Temperatures drop roughly 6°C per 1000m, so always bring a layer even on a warm valley day.",
            "Think layers and good footwear. Boots with a grippy sole and ankle support, 2L of water, and a packable waterproof — the weather flips fast above the treeline. Add sunscreen and a hat (UV is fierce on the pale rock), a couple of snacks, and poles for the knees on the way down. A warm mid-layer earns its place in the bag even in July: it's roughly 6°C colder for every 1000m you climb.",
        ],
        'it': [
            "Per un'escursione di media difficoltà la cosa più importante sono gli scarponi con supporto alla caviglia — i ghiaioni alpini lo richiedono. Porta 2L d'acqua, una giacca antipioggia (i temporali pomeridiani sono frequenti da giugno ad agosto, cerca di essere sotto il limite del bosco entro le 13:00), uno snack e crema solare. I bastoncini aiutano molto in discesa. La temperatura scende di circa 6°C ogni 1000 m, quindi porta sempre uno strato anche in una calda giornata di fondovalle.",
            "Pensa a strati e buone calzature. Scarponi con suola grippante e supporto alla caviglia, 2L d'acqua e un impermeabile comprimibile — sopra il limite del bosco il tempo cambia in fretta. Aggiungi crema solare e cappello (gli UV sono forti sulla roccia chiara), un paio di snack e i bastoncini per le ginocchia in discesa. Uno strato intermedio caldo merita un posto nello zaino anche a luglio: fa circa 6°C in meno ogni 1000 m di salita.",
        ],
        'de': [
            "Für eine mittelschwere Tour ist das Wichtigste ein Wanderschuh mit Knöchelstütze — der alpine Schotter verlangt das. Pack 2L Wasser, eine Regenschicht (Nachmittagsgewitter sind von Juni bis August häufig, sei bis 13 Uhr unter der Baumgrenze), einen Snack und Sonnencreme ein. Stöcke helfen im Abstieg deutlich. Die Temperatur fällt etwa 6°C pro 1000 m, nimm also auch an einem warmen Taltag eine Schicht mit.",
            "Denk an Schichten und gutes Schuhwerk. Schuhe mit griffiger Sohle und Knöchelstütze, 2L Wasser und eine packbare Regenjacke — über der Baumgrenze schlägt das Wetter schnell um. Dazu Sonnencreme und Hut (die UV-Strahlung ist auf dem hellen Fels heftig), ein paar Snacks und Stöcke für die Knie im Abstieg. Eine warme Zwischenschicht verdient auch im Juli ihren Platz: pro 1000 Höhenmeter wird es rund 6°C kälter.",
        ],
    },

    # ── Food ─────────────────────────────────────────────────────────────────
    'food': {
        'en': [
            "The things I always tell people to try: Schlutzkrapfen — half-moon pasta filled with ricotta and spinach, butter-tossed. The best version I know is in Val Gardena. Also Speck with rye bread and local cheese at any malga stop, Kaiserschmarrn for dessert, and a cold Weizen on the terrace. If you're visiting in autumn, Torggelen — going to farm restaurants for new wine and roasted chestnuts — is worth planning a whole day around.",
            "South Tyrol food is half Italian, half Austrian, and all worth your appetite. Start with Speck and a slab of mountain cheese, then Knödel (Canederli) — bread dumplings in broth or with butter and cheese. Schlutzkrapfen if you see them fresh-made. For dessert it's Kaiserschmarrn or apple strudel, no debate. Wash it down with a Weizen or a glass of local Vernatsch. Eat your big meal at a malga or rifugio at altitude — it always tastes better up there.",
        ],
        'it': [
            "Le cose che consiglio sempre di provare: gli Schlutzkrapfen — mezzelune ripiene di ricotta e spinaci, saltate nel burro. La versione migliore che conosco è in Val Gardena. Poi lo Speck con pane di segale e formaggio locale in qualsiasi malga, il Kaiserschmarrn per dolce e una Weizen fresca in terrazza. Se vieni in autunno, il Törggelen — andare nelle osterie contadine per vino nuovo e caldarroste — merita di pianificarci un'intera giornata.",
            "La cucina altoatesina è metà italiana, metà austriaca, e tutta da gustare. Inizia con lo Speck e una bella fetta di formaggio di montagna, poi i Knödel (canederli) — gnocchi di pane in brodo o con burro e formaggio. Gli Schlutzkrapfen se li trovi fatti freschi. Per dolce, Kaiserschmarrn o strudel di mele, senza discussioni. Accompagna con una Weizen o un calice di Vernatsch locale. Fai il pasto principale in una malga o in un rifugio in quota — lassù è sempre più buono.",
        ],
        'de': [
            "Was ich immer zum Probieren empfehle: Schlutzkrapfen — halbmondförmige Teigtaschen mit Ricotta und Spinat, in Butter geschwenkt. Die beste Version kenne ich in Gröden. Dazu Speck mit Roggenbrot und Bergkäse auf jeder Alm, Kaiserschmarrn als Nachtisch und ein kühles Weizen auf der Terrasse. Wenn du im Herbst kommst, lohnt das Törggelen — Buschenschank mit neuem Wein und gerösteten Kastanien — einen ganzen Tag.",
            "Die Südtiroler Küche ist halb italienisch, halb österreichisch — und ganz dein Appetit wert. Beginne mit Speck und einem Stück Bergkäse, dann Knödel (Canederli) — Brotknödel in der Suppe oder mit Butter und Käse. Schlutzkrapfen, wenn du sie frisch gemacht siehst. Als Nachtisch Kaiserschmarrn oder Apfelstrudel, keine Diskussion. Dazu ein Weizen oder ein Glas Vernatsch. Die große Mahlzeit nimmst du auf einer Alm oder Hütte in der Höhe — dort oben schmeckt es immer besser.",
        ],
    },

    # ── Booking ──────────────────────────────────────────────────────────────
    'booking': {
        'en': [
            "Most rifugios don't use online booking — call them directly. Say: 'Buonasera, vorrei prenotare mezza pensione per [number] persone per la notte del [date].' They'll ask which trail you're arriving on — that's a safety protocol, not just curiosity. July and August weekends fill up 2–3 weeks out. Half-board (dinner + bed + breakfast) is better value than à la carte — ask for it specifically.",
            "Booking a rifugio is old-school: phone, not website. A few words of Italian go a long way — ask for 'mezza pensione' (half board), which is bed, dinner and breakfast, and almost always the best deal. Bring a sleeping-bag liner (sacco lenzuolo) — most huts require one. Weekends in high summer book out weeks ahead, so call early, and let them know roughly when and via which trail you'll arrive.",
        ],
        'it': [
            "La maggior parte dei rifugi non usa la prenotazione online — chiamali direttamente. Di': «Buonasera, vorrei prenotare mezza pensione per [numero] persone per la notte del [data].» Ti chiederanno da quale sentiero arrivi — è un protocollo di sicurezza, non semplice curiosità. I fine settimana di luglio e agosto si riempiono con 2–3 settimane di anticipo. La mezza pensione (cena + pernottamento + colazione) conviene più dell'à la carte — chiedila esplicitamente.",
            "Prenotare un rifugio è all'antica: telefono, non sito web. Poche parole d'italiano fanno la differenza — chiedi la «mezza pensione», cioè letto, cena e colazione, quasi sempre l'offerta migliore. Porta un sacco lenzuolo — la maggior parte dei rifugi lo richiede. Nei weekend di piena estate si prenota con settimane d'anticipo, quindi chiama presto e indica più o meno quando e da quale sentiero arriverai.",
        ],
        'de': [
            "Die meisten Hütten nutzen keine Online-Buchung — ruf direkt an. Sag: „Buonasera, vorrei prenotare mezza pensione per [Anzahl] persone per la notte del [Datum].“ Man fragt dich, über welchen Weg du kommst — das ist ein Sicherheitsprotokoll, keine reine Neugier. Wochenenden im Juli und August sind 2–3 Wochen im Voraus voll. Halbpension (Abendessen + Bett + Frühstück) ist günstiger als à la carte — frag gezielt danach.",
            "Eine Hütte zu buchen ist altmodisch: Telefon, nicht Website. Ein paar Worte Italienisch helfen sehr — frag nach „mezza pensione“ (Halbpension), also Bett, Abendessen und Frühstück, fast immer das beste Angebot. Nimm einen Hüttenschlafsack (sacco lenzuolo) mit — die meisten Hütten verlangen einen. Wochenenden im Hochsommer sind Wochen im Voraus ausgebucht, also ruf früh an und sag ungefähr, wann und über welchen Weg du ankommst.",
        ],
    },

    # ── Rifugio types ────────────────────────────────────────────────────────
    'rifugioTypes': {
        'en': [
            "A rifugio is a staffed mountain hut — meals, beds, and usually a terrace with a view. A malga is a working alpine dairy farm, simpler, often just cheese, bread, and soup, but sometimes the most honest stop on the trail. Bivacchi are unstaffed emergency shelters — always unlocked, always free, no food. Tipping 5–10% is normal at rifugios, and most prefer cash.",
            "Three kinds of mountain stop up here: a rifugio is the full experience — staffed, hot meals, a bed, sometimes a hot shower. A malga is a real dairy farm that feeds passing hikers; simple, cheap, unforgettable cheese. A bivacco is a bare metal or stone shelter, always open and free, meant for emergencies or self-sufficient nights. At rifugios bring cash, a liner sheet for the bunk, and your own slippers if you're fussy — they swap your boots for hut shoes at the door.",
        ],
        'it': [
            "Un rifugio è una capanna di montagna gestita — pasti, posti letto e di solito una terrazza con vista. Una malga è una vera azienda casearia d'alpeggio, più semplice, spesso solo formaggio, pane e zuppa, ma a volte la sosta più autentica del sentiero. I bivacchi sono ricoveri d'emergenza non gestiti — sempre aperti, sempre gratuiti, senza cibo. Una mancia del 5–10% è normale nei rifugi, e quasi tutti preferiscono i contanti.",
            "Tre tipi di sosta in montagna quassù: il rifugio è l'esperienza completa — gestito, pasti caldi, un letto, a volte una doccia calda. La malga è una vera azienda casearia che sfama gli escursionisti di passaggio; semplice, economica, con un formaggio indimenticabile. Il bivacco è un riparo spoglio di metallo o pietra, sempre aperto e gratuito, pensato per le emergenze o le notti in autonomia. Nei rifugi porta contanti, un sacco lenzuolo per la branda e, se sei pignolo, le tue ciabatte — all'ingresso scambiano gli scarponi con le pantofole della casa.",
        ],
        'de': [
            "Eine Hütte (rifugio) ist eine bewirtschaftete Berghütte — Essen, Betten und meist eine Terrasse mit Aussicht. Eine Alm (malga) ist ein echter Almbetrieb, einfacher, oft nur Käse, Brot und Suppe, aber manchmal der ehrlichste Halt am Weg. Biwakschachteln (bivacchi) sind unbewirtschaftete Notunterkünfte — immer offen, immer kostenlos, ohne Essen. Trinkgeld von 5–10% ist auf Hütten üblich, und die meisten bevorzugen Bargeld.",
            "Drei Arten von Bergstopp hier oben: Die Hütte ist das volle Erlebnis — bewirtschaftet, warme Mahlzeiten, ein Bett, manchmal eine warme Dusche. Die Alm ist ein echter Milchbetrieb, der vorbeikommende Wanderer verköstigt; einfach, günstig, unvergesslicher Käse. Das Biwak ist ein kahler Metall- oder Steinunterstand, immer offen und kostenlos, für Notfälle oder autarke Nächte. Auf Hütten bring Bargeld, ein Hüttenschlafsack-Laken und, wenn du heikel bist, eigene Hausschuhe mit — am Eingang tauscht man die Schuhe gegen Hüttenpatschen.",
        ],
    },

    # ── Buses / Guest Pass ───────────────────────────────────────────────────
    'bus': {
        'en': [
            "SAD buses cover the whole region — most routes run hourly on weekdays, less on Sundays. Guests in registered accommodation get the Südtirol Guest Pass, which makes all SAD buses free. The Alto Adige/Südtirol Pass includes buses, most trains, and the main cable cars. The VinschgauBahn from Merano to Malles is one of the most scenic rail journeys in the Alps.",
            "Public transport here is genuinely good. The integrated network (bus + train + many cable cars) runs on the Südtirol Pass, and if you're staying overnight ask your host for the free Guest Pass — it covers the SAD buses. Timetables and live times are on the 'suedtirolmobil' app or sad.it. Plan around Sunday/holiday reductions, and check the last bus back before you commit to a one-way hike — valley services can stop surprisingly early.",
        ],
        'it': [
            "Gli autobus SAD coprono tutta la regione — la maggior parte delle linee è oraria nei giorni feriali, meno la domenica. Gli ospiti delle strutture registrate ricevono la Südtirol Guest Pass, che rende gratuiti tutti gli autobus SAD. L'Alto Adige Pass include autobus, quasi tutti i treni e le principali funivie. La VinschgauBahn da Merano a Malles è uno dei viaggi in treno più panoramici delle Alpi.",
            "I trasporti pubblici qui sono davvero buoni. La rete integrata (bus + treno + molte funivie) funziona con l'Alto Adige Pass, e se pernotti chiedi al tuo host la Guest Pass gratuita — copre gli autobus SAD. Orari e tempi in tempo reale sono sull'app «suedtirolmobil» o su sad.it. Tieni conto delle riduzioni domenicali/festive e controlla l'ultimo bus di ritorno prima di impegnarti in un percorso di sola andata — i servizi di valle possono finire sorprendentemente presto.",
        ],
        'de': [
            "SAD-Busse decken die ganze Region ab — die meisten Linien fahren werktags stündlich, sonntags seltener. Gäste in gemeldeten Unterkünften bekommen die Südtirol Guest Pass, mit der alle SAD-Busse kostenlos sind. Der Südtirol Pass umfasst Busse, die meisten Züge und die wichtigsten Seilbahnen. Die Vinschgaubahn von Meran nach Mals ist eine der landschaftlich schönsten Bahnfahrten der Alpen.",
            "Der öffentliche Verkehr ist hier richtig gut. Das integrierte Netz (Bus + Bahn + viele Seilbahnen) läuft über den Südtirol Pass, und wenn du übernachtest, frag deinen Gastgeber nach der kostenlosen Guest Pass — sie deckt die SAD-Busse ab. Fahrpläne und Echtzeit gibt es in der App „suedtirolmobil“ oder auf sad.it. Plane Sonntags-/Feiertagsreduzierungen ein und prüfe den letzten Bus zurück, bevor du dich auf eine Einweg-Tour festlegst — Talverbindungen enden überraschend früh.",
        ],
    },

    # ── Emergency (SAFETY) ───────────────────────────────────────────────────
    'emergency': {
        'en': [
            "Alpine rescue in Italy: call 118 (Soccorso Alpino) — completely free, no billing ever. If you can, give them your GPS coordinates — on iPhone open Maps, long-press the screen, the coordinates appear at the top. The mountain distress signal is 6 whistle blasts or torch flashes per minute. If a storm catches you on an exposed ridge: descend immediately, crouch away from the high point, avoid lone trees and summit crosses. Always tell someone your plan before heading out.",
            "In an emergency call 118 — that's mountain rescue (Soccorso Alpino), and it's free. The Europe-wide 112 works too and can locate you. Install the GeoResQ or 'Where ARE U' app beforehand so it can send your exact position. Six signals a minute (whistle, light or shout) is the recognised call for help; three a minute is the reply. Caught by lightning on a ridge? Get down fast, ditch metal poles, and crouch low on your pack away from the summit cross. And always leave your route and return time with someone in the valley.",
        ],
        'it': [
            "Soccorso alpino in Italia: chiama il 118 (Soccorso Alpino) — completamente gratuito, nessun addebito mai. Se puoi, fornisci le tue coordinate GPS — su iPhone apri Mappe, tieni premuto sullo schermo e le coordinate compaiono in alto. Il segnale di soccorso alpino è 6 fischi o lampi di torcia al minuto. Se un temporale ti coglie su una cresta esposta: scendi subito, accovacciati lontano dal punto più alto, evita alberi isolati e croci di vetta. Prima di partire, di' sempre a qualcuno il tuo piano.",
            "In emergenza chiama il 118 — è il soccorso alpino (Soccorso Alpino), ed è gratuito. Funziona anche il 112 europeo, che può localizzarti. Installa prima l'app GeoResQ o «Where ARE U» così può inviare la tua posizione esatta. Sei segnali al minuto (fischio, luce o grido) è la richiesta di aiuto riconosciuta; tre al minuto è la risposta. Colto da un fulmine su una cresta? Scendi in fretta, abbandona i bastoncini di metallo e accovacciati basso sullo zaino, lontano dalla croce di vetta. E lascia sempre il tuo percorso e l'orario di rientro a qualcuno a valle.",
        ],
        'de': [
            "Bergrettung in Italien: wähle 118 (Soccorso Alpino) — völlig kostenlos, nie eine Rechnung. Wenn möglich, gib deine GPS-Koordinaten durch — auf dem iPhone Karten öffnen, lange auf den Bildschirm drücken, die Koordinaten erscheinen oben. Das alpine Notsignal sind 6 Pfiffe oder Lichtzeichen pro Minute. Wenn dich ein Gewitter auf einem exponierten Grat erwischt: sofort absteigen, abseits vom höchsten Punkt in die Hocke, einzelne Bäume und Gipfelkreuze meiden. Sag vor dem Aufbruch immer jemandem deinen Plan.",
            "Im Notfall wähle 118 — das ist die Bergrettung (Soccorso Alpino), und sie ist kostenlos. Auch der europaweite Notruf 112 funktioniert und kann dich orten. Installiere vorher die App GeoResQ oder „Where ARE U“, damit sie deine genaue Position senden kann. Sechs Signale pro Minute (Pfiff, Licht oder Ruf) ist der anerkannte Hilferuf; drei pro Minute die Antwort. Vom Blitz auf einem Grat überrascht? Schnell runter, Metallstöcke weg und tief auf dem Rucksack kauern, abseits vom Gipfelkreuz. Und hinterlass immer Route und Rückkehrzeit bei jemandem im Tal.",
        ],
    },

    # ── When to start ────────────────────────────────────────────────────────
    'startTime': {
        'en': [
            "Start early — it's the single best habit in these mountains. Be walking by 8, ideally 7 in high summer. Afternoon thunderstorms build fast from about 13:00–14:00, so an early start gets you off the exposed ground before they arrive, gives you the quiet trails and the best light, and leaves a margin if anything runs long.",
            "Early. Always earlier than feels necessary. The classic alpine pattern is clear mornings and building cloud after lunch, with storms possible by mid-afternoon, so aim to summit or turn around by around midday. An 7–8am start also means parking is still free and the rifugio terraces aren't packed yet.",
        ],
        'it': [
            "Parti presto — è la migliore abitudine in queste montagne. Cammina già dalle 8, idealmente dalle 7 in piena estate. I temporali pomeridiani si formano in fretta dalle 13:00–14:00 circa, quindi una partenza mattutina ti toglie dai terreni esposti prima che arrivino, ti regala sentieri tranquilli e la luce migliore, e lascia un margine se qualcosa va per le lunghe.",
            "Presto. Sempre prima di quanto sembri necessario. Lo schema classico alpino è mattine limpide e nubi in aumento dopo pranzo, con temporali possibili a metà pomeriggio: punta a raggiungere la cima o a tornare indietro verso mezzogiorno. Partire alle 7–8 significa anche parcheggio ancora gratuito e terrazze dei rifugi non ancora affollate.",
        ],
        'de': [
            "Starte früh — das ist die beste Gewohnheit in diesen Bergen. Geh um 8 los, im Hochsommer am besten um 7. Nachmittagsgewitter bauen sich ab etwa 13:00–14:00 schnell auf, ein früher Start bringt dich also vor ihnen vom exponierten Gelände, schenkt dir ruhige Wege und das beste Licht und lässt Spielraum, falls etwas länger dauert.",
            "Früh. Immer früher, als es nötig scheint. Das klassische alpine Muster ist klare Morgen und aufziehende Wolken nach dem Mittag, mit möglichen Gewittern am frühen Nachmittag — ziel also darauf, bis Mittag den Gipfel zu erreichen oder umzukehren. Ein Start um 7–8 Uhr bedeutet auch noch kostenloses Parken und nicht überfüllte Hüttenterrassen.",
        ],
    },

    # ── Single-string practical answers ──────────────────────────────────────
    'water': {
        'en': ["Carry 2L as a baseline, 3L on a hot or hard day. You can refill at rifugios and at most village fountains (if it doesn't say 'Kein Trinkwasser / Acqua non potabile', it's drinkable). High mountain streams look pristine but can have livestock upstream, so I wouldn't drink untreated unless you have a filter or purification tablets. Malghe will almost always top up your bottle if you ask nicely."],
        'it': ["Porta 2L come base, 3L in una giornata calda o impegnativa. Puoi riempire la borraccia ai rifugi e alla maggior parte delle fontane di paese (se non c'è scritto «Kein Trinkwasser / Acqua non potabile», è potabile). I torrenti d'alta montagna sembrano incontaminati ma possono avere bestiame a monte, quindi non berrei senza trattarla, a meno che tu non abbia un filtro o pastiglie potabilizzanti. Le malghe quasi sempre ti riempiono la borraccia se chiedi gentilmente."],
        'de': ["Nimm 2L als Grundregel mit, 3L an einem heißen oder schweren Tag. Auffüllen kannst du an Hütten und an den meisten Dorfbrunnen (steht nicht „Kein Trinkwasser / Acqua non potabile“ dabei, ist es trinkbar). Hochgebirgsbäche sehen rein aus, können aber Vieh flussaufwärts haben — ohne Filter oder Entkeimungstabletten würde ich nicht ungereinigt trinken. Almen füllen dir fast immer die Flasche auf, wenn du nett fragst."],
    },
    'cash': {
        'en': ["Bring cash. Many rifugios and malghe are card-friendly now, but signal is patchy up high and card machines fail, so I always carry enough euros to cover meals, a bed and a drink or two. Smaller dairy farms are often cash-only. Draw money in the valley — ATMs (Bancomat) are easy to find in towns but non-existent on the mountain."],
        'it': ["Porta contanti. Molti rifugi e malghe ora accettano la carta, ma in quota il segnale è incostante e i POS si bloccano, quindi tengo sempre abbastanza euro per pasti, pernottamento e un paio di consumazioni. Le malghe più piccole sono spesso solo contanti. Preleva a valle — i Bancomat sono facili da trovare in paese ma inesistenti in montagna."],
        'de': ["Nimm Bargeld mit. Viele Hütten und Almen akzeptieren inzwischen Karte, aber in der Höhe ist der Empfang lückenhaft und Kartengeräte fallen aus — ich habe immer genug Euro für Essen, ein Bett und ein, zwei Getränke dabei. Kleinere Almbetriebe sind oft nur bar. Heb das Geld im Tal ab — Bankomaten findest du leicht in den Orten, am Berg gar nicht."],
    },
    'altitude': {
        'en': ["Good news — most of South Tyrol's trails top out between 2000 and 3000m, where serious altitude sickness is uncommon. You might feel a little more breathless and tire faster than at home, so pace yourself, hydrate well, and don't gain huge height too fast if you've come straight from sea level. On the 3000m+ summits and glaciers, take it slow and turn back if you get a persistent headache, nausea or dizziness — that's your body telling you to descend."],
        'it': ["Buone notizie — la maggior parte dei sentieri dell'Alto Adige arriva tra i 2000 e i 3000 m, dove il mal di montagna serio è raro. Potresti sentirti un po' più affannato e stancarti prima che a casa, quindi dosa il passo, idratati bene e non guadagnare quota troppo in fretta se arrivi dal livello del mare. Sulle cime oltre i 3000 m e sui ghiacciai vai piano e torna indietro se hai mal di testa persistente, nausea o vertigini — è il corpo che ti dice di scendere."],
        'de': ["Gute Nachricht — die meisten Wege Südtirols enden zwischen 2000 und 3000 m, wo ernsthafte Höhenkrankheit selten ist. Du bist vielleicht etwas kurzatmiger und ermüdest schneller als zu Hause, also teil dir die Kräfte ein, trink gut und gewinne nicht zu schnell viel Höhe, wenn du direkt vom Meeresspiegel kommst. Auf den 3000ern und Gletschern geh langsam und kehr um, wenn du anhaltende Kopfschmerzen, Übelkeit oder Schwindel bekommst — das ist dein Körper, der dir sagt: absteigen."],
    },
    'navigation': {
        'en': ["Trails here use the CAI system: red-white-red paint flashes and numbered signposts at every junction. Each path has a number — note the numbers for your route rather than place names, since signs list many destinations. Red-white-red is a normal footpath; a number on a red background usually means a more demanding or via-ferrata route. Phone signal drops above the valleys, so download an offline map or GPS track (Komoot, Outdooractive or maps.me) before you set off."],
        'it': ["I sentieri qui usano il sistema CAI: segnavia bianco-rosso-bianco e cartelli numerati a ogni bivio. Ogni sentiero ha un numero — annota i numeri del tuo percorso più che i nomi dei luoghi, perché i cartelli elencano molte mete. Bianco-rosso-bianco è un normale sentiero; un numero su sfondo rosso di solito indica un percorso più impegnativo o una via ferrata. Il segnale telefonico cala sopra le valli, quindi scarica una mappa offline o una traccia GPS (Komoot, Outdooractive o maps.me) prima di partire."],
        'de': ["Die Wege hier nutzen das CAI-System: rot-weiß-rote Markierungen und nummerierte Schilder an jeder Kreuzung. Jeder Weg hat eine Nummer — merk dir die Nummern deiner Route statt der Ortsnamen, da Schilder viele Ziele auflisten. Rot-weiß-rot ist ein normaler Wanderweg; eine Nummer auf rotem Grund bedeutet meist eine anspruchsvollere Route oder einen Klettersteig. Der Empfang fällt über den Tälern ab, lade also vor dem Start eine Offline-Karte oder einen GPS-Track herunter (Komoot, Outdooractive oder maps.me)."],
    },
    'fitness': {
        'en': ["You don't need to be an athlete — you need a realistic match between the route and your legs. If you can walk briskly for 2–3 hours with some uphill, plenty of easy and medium trails are open to you. The honest test is descent: knees and ankles take a beating going down, so poles help and steady pacing beats speed. Tell me how long you usually walk and how much climbing feels comfortable, and I'll point you at trails that fit."],
        'it': ["Non devi essere un atleta — serve un abbinamento realistico tra il percorso e le tue gambe. Se cammini di buon passo per 2–3 ore con un po' di salita, hai a disposizione moltissimi sentieri facili e medi. La vera prova è la discesa: ginocchia e caviglie soffrono in discesa, quindi i bastoncini aiutano e un passo costante batte la velocità. Dimmi quanto cammini di solito e quanto dislivello ti senti di fare, e ti indico i sentieri giusti."],
        'de': ["Du musst kein Athlet sein — du brauchst eine realistische Abstimmung zwischen Route und deinen Beinen. Wenn du 2–3 Stunden zügig mit etwas Steigung gehen kannst, stehen dir viele leichte und mittlere Wege offen. Der ehrliche Test ist der Abstieg: Knie und Knöchel leiden bergab, daher helfen Stöcke, und gleichmäßiges Tempo schlägt Schnelligkeit. Sag mir, wie lange du normalerweise gehst und wie viel Anstieg sich angenehm anfühlt, und ich nenne dir passende Wege."],
    },
    'photography': {
        'en': ["The Dolomites glow at dawn and dusk — that pink-gold light on the rock is called enrosadira, and it's worth setting an alarm for. For sunrise, places like Seceda, the Alpe di Siusi and the Tre Cime saddle are unbeatable; for sunset, anywhere with the peaks to your east. Shoot in the first and last hour of light, bring a small tripod for the low sun, and remember drones are restricted in the nature parks — check local rules before you fly. Tell me your area and I'll suggest a viewpoint."],
        'it': ["Le Dolomiti si accendono all'alba e al tramonto — quella luce rosa-oro sulla roccia si chiama enrosadira, e vale la sveglia. Per l'alba, posti come Seceda, l'Alpe di Siusi e la sella delle Tre Cime sono imbattibili; per il tramonto, qualunque punto con le cime a est. Scatta nella prima e nell'ultima ora di luce, porta un piccolo treppiede per il sole basso e ricorda che i droni sono soggetti a restrizioni nei parchi naturali — controlla le regole locali prima di volare. Dimmi la tua zona e ti suggerisco un punto panoramico."],
        'de': ["Die Dolomiten glühen bei Sonnenauf- und -untergang — dieses rosa-goldene Licht auf dem Fels heißt Enrosadira und ist einen Wecker wert. Für den Sonnenaufgang sind Orte wie Seceda, die Seiser Alm und die Tre-Cime-Scharte unschlagbar; für den Sonnenuntergang jeder Punkt mit den Gipfeln im Osten. Fotografiere in der ersten und letzten Lichtstunde, nimm ein kleines Stativ für die tiefe Sonne mit, und denk dran: Drohnen sind in den Naturparks eingeschränkt — prüf die lokalen Regeln vor dem Fliegen. Sag mir deine Gegend und ich schlage dir einen Aussichtspunkt vor."],
    },
    'connectivity': {
        'en': ["Don't count on it. Coverage is good in the valleys and towns but disappears on the far side of a ridge or in deep valleys, and even rifugio WiFi is slow and weather-dependent. Download your maps, tickets and trail notes offline before you leave, tell someone your plan, and keep your phone in battery-saver — its real job up there is the GPS and the emergency call, not Instagram."],
        'it': ["Non contarci. La copertura è buona in valle e nei paesi ma sparisce dietro una cresta o nelle valli profonde, e persino il WiFi dei rifugi è lento e dipende dal meteo. Scarica mappe, biglietti e note del sentiero offline prima di partire, di' a qualcuno il tuo piano e tieni il telefono in risparmio energetico — lassù il suo vero compito è il GPS e la chiamata d'emergenza, non Instagram."],
        'de': ["Verlass dich nicht darauf. Der Empfang ist in Tälern und Orten gut, verschwindet aber hinter einem Grat oder in tiefen Tälern, und selbst das Hütten-WLAN ist langsam und wetterabhängig. Lade Karten, Tickets und Wegnotizen vor dem Aufbruch offline, sag jemandem deinen Plan und lass das Handy im Energiesparmodus — seine echte Aufgabe dort oben sind GPS und Notruf, nicht Instagram."],
    },
    'language': {
        'en': ["South Tyrol is trilingual: German is the everyday language for most locals, Italian is official everywhere, and in a few Dolomite valleys they speak Ladin. English is widely understood in tourist areas. A few words go a long way though — 'Grüß Gott' (hello), 'Danke' (thanks), 'Buongiorno' and 'Grazie' all earn a smile. In a rifugio, 'Ein Bier, bitte' or 'Un'acqua, per favore' will never fail you."],
        'it': ["L'Alto Adige è trilingue: il tedesco è la lingua quotidiana per la maggior parte degli abitanti, l'italiano è ufficiale ovunque e in alcune valli dolomitiche si parla ladino. L'inglese è ben compreso nelle zone turistiche. Però poche parole fanno la differenza — «Grüß Gott» (ciao), «Danke» (grazie), «Buongiorno» e «Grazie» strappano sempre un sorriso. In rifugio, «Ein Bier, bitte» o «Un'acqua, per favore» non ti deluderanno mai."],
        'de': ["Südtirol ist dreisprachig: Deutsch ist für die meisten Einheimischen die Alltagssprache, Italienisch überall offiziell, und in einigen Dolomitentälern spricht man Ladinisch. Englisch wird in Tourismusgebieten gut verstanden. Ein paar Worte helfen aber sehr — „Grüß Gott“ (Hallo), „Danke“, „Buongiorno“ und „Grazie“ bringen immer ein Lächeln. Auf der Hütte funktionieren „Ein Bier, bitte“ oder „Un'acqua, per favore“ immer."],
    },
    'guide': {
        'en': ["For marked trails you don't need a guide — good preparation and an offline map are enough. But for glaciers, harder via ferrate, or any off-trail/alpine objective, a certified mountain guide (Bergführer / guida alpina) is money well spent: they carry the safety kit, read the conditions, and know the escape routes. Local guiding offices and alpine schools in the main valleys can pair you with one — book a few days ahead in peak season."],
        'it': ["Per i sentieri segnati non serve una guida — bastano una buona preparazione e una mappa offline. Ma per i ghiacciai, le ferrate più difficili o qualsiasi obiettivo fuori sentiero/alpinistico, una guida alpina certificata (Bergführer / guida alpina) è denaro ben speso: porta il materiale di sicurezza, legge le condizioni e conosce le vie di fuga. Gli uffici guide e le scuole di alpinismo nelle valli principali possono abbinartene una — prenota con qualche giorno di anticipo in alta stagione."],
        'de': ["Für markierte Wege brauchst du keinen Führer — gute Vorbereitung und eine Offline-Karte reichen. Aber für Gletscher, schwerere Klettersteige oder jedes weglose/alpine Ziel ist ein zertifizierter Bergführer (guida alpina) gut angelegtes Geld: er trägt die Sicherheitsausrüstung, liest die Bedingungen und kennt die Fluchtwege. Bergführerbüros und Alpinschulen in den Haupttälern vermitteln dir einen — in der Hochsaison ein paar Tage im Voraus buchen."],
    },
    'toilets': {
        'en': ["Rifugios and malghe have toilets — a small coin or a purchase is the polite norm at the busier ones. Between huts there's nothing, so go before you leave the last one. If you're caught out, step well away from the path and any water source, and pack out any paper — these are protected landscapes and they stay beautiful because people take their litter home."],
        'it': ["Rifugi e malghe hanno i servizi — una monetina o una consumazione è la norma di cortesia in quelli più frequentati. Tra un rifugio e l'altro non c'è nulla, quindi vai prima di lasciare l'ultimo. Se ti cogli impreparato, allontanati bene dal sentiero e da qualsiasi fonte d'acqua, e porta via la carta — sono paesaggi protetti e restano belli perché la gente riporta a casa i propri rifiuti."],
        'de': ["Hütten und Almen haben Toiletten — eine kleine Münze oder ein Verzehr ist bei den belebteren die höfliche Norm. Zwischen den Hütten gibt es nichts, also geh, bevor du die letzte verlässt. Wenn es dich überrascht, geh weit weg vom Weg und von jeder Wasserquelle und nimm das Papier wieder mit — das sind geschützte Landschaften, und sie bleiben schön, weil die Leute ihren Müll mit nach Hause nehmen."],
    },
    'whoAreYou': {
        'en': ["I'm Josephine — your alpine companion for South Tyrol and the Dolomites. I can plan your day around the weather and how you're feeling, recommend trails and rifugios, and answer the practical stuff: opening seasons, how to get there, gear, dogs, difficulty, food, and emergencies. Tell me how much time you have and what kind of day you want, and I'll build it for you."],
        'it': ["Sono Josephine — la tua compagna alpina per l'Alto Adige e le Dolomiti. Posso pianificare la tua giornata in base al meteo e a come ti senti, consigliarti sentieri e rifugi e rispondere alle cose pratiche: stagioni di apertura, come arrivare, attrezzatura, cani, difficoltà, cibo ed emergenze. Dimmi quanto tempo hai e che tipo di giornata vuoi, e te la costruisco."],
        'de': ["Ich bin Josephine — deine alpine Begleiterin für Südtirol und die Dolomiten. Ich plane deinen Tag nach Wetter und Stimmung, empfehle Wege und Hütten und beantworte das Praktische: Öffnungszeiten, Anfahrt, Ausrüstung, Hunde, Schwierigkeit, Essen und Notfälle. Sag mir, wie viel Zeit du hast und was für einen Tag du möchtest, und ich stelle ihn dir zusammen."],
    },
    'greeting': {
        'en': [
            "Hello! Lovely to see you. Shall I find you a trail for today — tell me how much time you have and the kind of day you're after?",
            "Hi there! Ready for a mountain day? Give me your mood and your spare hours and I'll plan something that fits.",
            "Grüß Gott! I'm all yours — want a trail recommendation, a rifugio, or just some local know-how?",
        ],
        'it': [
            "Ciao! Che piacere vederti. Ti trovo un sentiero per oggi — dimmi quanto tempo hai e che tipo di giornata cerchi?",
            "Ciao! Pronto per una giornata in montagna? Dammi il tuo umore e le ore libere e ti pianifico qualcosa su misura.",
            "Grüß Gott! Sono tutta tua — vuoi un consiglio su un sentiero, un rifugio o solo un po' di sapere locale?",
        ],
        'de': [
            "Hallo! Schön, dich zu sehen. Soll ich dir einen Weg für heute finden — sag mir, wie viel Zeit du hast und was für einen Tag du suchst?",
            "Hallo! Bereit für einen Bergtag? Nenn mir deine Stimmung und deine freien Stunden, und ich plane etwas Passendes.",
            "Grüß Gott! Ich gehöre ganz dir — möchtest du eine Wegempfehlung, eine Hütte oder einfach etwas lokales Wissen?",
        ],
    },

    # ══ ENTITY-TEMPLATED (Batch 2) ═══════════════════════════════════════════
    # Data fragments ({access}, {desc}, prices, etc.) come from the dataset and
    # stay as-is; only the scaffolding is localized. Numbers/€/dates kept exact.

    # ── Opening / season — rifugio ──────────────────────────────────────────
    'openRifFuture': {
        'en': ["{name} is currently closed — it opens in {days} {dayWord}, on {start}. If you're planning ahead, I'd book well in advance — the good rifugios fill up fast."],
        'it': ["{name} è attualmente chiuso — apre tra {days} {dayWord}, il {start}. Se stai pianificando in anticipo, prenoterei con largo anticipo — i rifugi buoni si riempiono in fretta."],
        'de': ["{name} ist derzeit geschlossen — öffnet in {days} {dayWord}, am {start}. Wenn du vorausplanst, würde ich rechtzeitig buchen — die guten Hütten sind schnell voll."],
    },
    'openRifPast': {
        'en': ["{name} is closed for the season (was open until {end}). If you're planning ahead, I'd book well in advance — the good rifugios fill up fast."],
        'it': ["{name} è chiuso per la stagione (era aperto fino al {end}). Se stai pianificando in anticipo, prenoterei con largo anticipo — i rifugi buoni si riempiono in fretta."],
        'de': ["{name} ist für die Saison geschlossen (war bis {end} offen). Wenn du vorausplanst, würde ich rechtzeitig buchen — die guten Hütten sind schnell voll."],
    },
    'openRifNow': {
        'en': ["{name} is open right now until {end}. If you're planning ahead, I'd book well in advance — the good rifugios fill up fast."],
        'it': ["{name} è aperto proprio ora fino al {end}. Se stai pianificando in anticipo, prenoterei con largo anticipo — i rifugi buoni si riempiono in fretta."],
        'de': ["{name} ist gerade jetzt bis {end} geöffnet. Wenn du vorausplanst, würde ich rechtzeitig buchen — die guten Hütten sind schnell voll."],
    },
    'openRifRange': {
        'en': ["{name} is open from {start} to {end}. If you're planning ahead, I'd book well in advance — the good rifugios fill up fast."],
        'it': ["{name} è aperto dal {start} al {end}. Se stai pianificando in anticipo, prenoterei con largo anticipo — i rifugi buoni si riempiono in fretta."],
        'de': ["{name} ist von {start} bis {end} geöffnet. Wenn du vorausplanst, würde ich rechtzeitig buchen — die guten Hütten sind schnell voll."],
    },
    'openRifBivacco': {
        'en': ["{name} is a bivacco — it stays open year-round, no reservation needed."],
        'it': ["{name} è un bivacco — resta aperto tutto l'anno, senza prenotazione."],
        'de': ["{name} ist ein Biwak — es ist das ganze Jahr offen, keine Reservierung nötig."],
    },
    'openRifNoDates': {
        'en': ["I don't have specific season dates for {name} yet. Check their website or contact them directly."],
        'it': ["Non ho ancora le date precise di stagione per {name}. Controlla il sito o contattali direttamente."],
        'de': ["Ich habe noch keine genauen Saisondaten für {name}. Schau auf der Website nach oder kontaktiere sie direkt."],
    },

    # ── Opening / season — trail ────────────────────────────────────────────
    'openTrailIn': {
        'en': ["The best time for {name} is {seasons} — you're in the right window. Outside that period the path can be snowy or access roads closed."],
        'it': ["Il periodo migliore per {name} è {seasons} — sei nella finestra giusta. Fuori da quel periodo il sentiero può essere innevato o le strade d'accesso chiuse."],
        'de': ["Die beste Zeit für {name} ist {seasons} — du bist im richtigen Zeitfenster. Außerhalb dieser Zeit kann der Weg verschneit oder die Zufahrtsstraßen gesperrt sein."],
    },
    'openTrailOut': {
        'en': ["The best time for {name} is {seasons} — right now ({month}) is outside the ideal window. Outside that period the path can be snowy or access roads closed."],
        'it': ["Il periodo migliore per {name} è {seasons} — proprio ora ({month}) sei fuori dalla finestra ideale. Fuori da quel periodo il sentiero può essere innevato o le strade d'accesso chiuse."],
        'de': ["Die beste Zeit für {name} ist {seasons} — gerade jetzt ({month}) bist du außerhalb des idealen Zeitfensters. Außerhalb dieser Zeit kann der Weg verschneit oder die Zufahrtsstraßen gesperrt sein."],
    },
    'openTrailNoData': {
        'en': ["I don't have season restrictions for {name} — it should be walkable most of the year, conditions permitting."],
        'it': ["Non ho restrizioni stagionali per {name} — dovrebbe essere percorribile quasi tutto l'anno, condizioni permettendo."],
        'de': ["Ich habe keine Saisonbeschränkungen für {name} — er sollte fast das ganze Jahr begehbar sein, sofern es die Bedingungen zulassen."],
    },

    # ── Access / directions ─────────────────────────────────────────────────
    'accessInfo': {
        'en': ["To reach {name}: {access}"],
        'it': ["Per raggiungere {name}: {access}"],
        'de': ["So erreichst du {name}: {access}"],
    },
    'accessNone': {
        'en': ["I don't have turn-by-turn directions for {name} in my notes yet. I'd suggest checking the trail map in the app or a recent GPS track on Komoot."],
        'it': ["Non ho ancora indicazioni passo-passo per {name} nei miei appunti. Ti suggerisco di controllare la mappa del sentiero nell'app o una traccia GPS recente su Komoot."],
        'de': ["Ich habe noch keine Schritt-für-Schritt-Wegbeschreibung für {name} in meinen Notizen. Ich würde die Wegkarte in der App oder einen aktuellen GPS-Track auf Komoot prüfen."],
    },

    # ── Technical / danger ──────────────────────────────────────────────────
    'techTrailEasy': {
        'en': ["{name} is rated {diff} overall. Technically it's {tech}, with {exposure} exposure and {fitness} fitness demand. It is well within reach for most hikers."],
        'it': ["{name} è classificato {diff} nel complesso. Tecnicamente è {tech}, con esposizione {exposure} e richiesta fisica {fitness}. È ampiamente alla portata della maggior parte degli escursionisti."],
        'de': ["{name} ist insgesamt als {diff} eingestuft. Technisch ist er {tech}, mit {exposure} Exponiertheit und {fitness} Konditionsanforderung. Er ist für die meisten Wanderer gut machbar."],
    },
    'techTrailMedium': {
        'en': ["{name} is rated {diff} overall. Technically it's {tech}, with {exposure} exposure and {fitness} fitness demand. Make sure your footwear has good grip."],
        'it': ["{name} è classificato {diff} nel complesso. Tecnicamente è {tech}, con esposizione {exposure} e richiesta fisica {fitness}. Assicurati che le calzature abbiano una buona aderenza."],
        'de': ["{name} ist insgesamt als {diff} eingestuft. Technisch ist er {tech}, mit {exposure} Exponiertheit und {fitness} Konditionsanforderung. Achte auf Schuhe mit gutem Grip."],
    },
    'techTrailHard': {
        'en': ["{name} is rated {diff} overall. Technically it's {tech}, with {exposure} exposure and {fitness} fitness demand. I recommend it only for confident, experienced hikers."],
        'it': ["{name} è classificato {diff} nel complesso. Tecnicamente è {tech}, con esposizione {exposure} e richiesta fisica {fitness}. Lo consiglio solo a escursionisti sicuri ed esperti."],
        'de': ["{name} ist insgesamt als {diff} eingestuft. Technisch ist er {tech}, mit {exposure} Exponiertheit und {fitness} Konditionsanforderung. Ich empfehle ihn nur sicheren, erfahrenen Wanderern."],
    },
    'techRifugio': {
        'en': ["{name} is a rifugio — the approach difficulty depends on which trail you take to reach it. Check the access info and pick a route that matches your level."],
        'it': ["{name} è un rifugio — la difficoltà dell'avvicinamento dipende dal sentiero che scegli per arrivarci. Controlla le info di accesso e scegli un percorso adatto al tuo livello."],
        'de': ["{name} ist eine Hütte — die Schwierigkeit des Zustiegs hängt davon ab, welchen Weg du nimmst. Prüf die Zugangsinfos und wähl eine Route, die zu deinem Niveau passt."],
    },

    # ── Dog-friendly ────────────────────────────────────────────────────────
    'dogTrailYes': {
        'en': ["Good news — {name} is dog-friendly! Keep your dog on a lead near the farms and wildlife areas."],
        'it': ["Buone notizie — {name} ammette i cani! Tieni il cane al guinzaglio vicino alle malghe e alle zone faunistiche."],
        'de': ["Gute Nachricht — auf {name} sind Hunde erlaubt! Halte deinen Hund in der Nähe der Almen und Wildschutzgebiete an der Leine."],
    },
    'dogTrailNo': {
        'en': ["{name} doesn't allow dogs, unfortunately. Wildlife protection rules in this area restrict it."],
        'it': ["{name} purtroppo non ammette i cani. Le norme di protezione della fauna in questa zona lo vietano."],
        'de': ["Auf {name} sind Hunde leider nicht erlaubt. Wildschutzregeln in diesem Gebiet schränken das ein."],
    },
    'dogTrailUnknown': {
        'en': ["I don't have confirmed dog-friendly info for {name} — check with the local forestry office to be sure."],
        'it': ["Non ho informazioni confermate sull'ammissione dei cani per {name} — per sicurezza chiedi all'ufficio forestale locale."],
        'de': ["Ich habe für {name} keine bestätigte Hunde-Info — frag zur Sicherheit beim örtlichen Forstamt nach."],
    },
    'dogRifYes': {
        'en': ["{name} welcomes dogs — just mention it when you book so they can prepare."],
        'it': ["{name} accoglie i cani — segnalalo al momento della prenotazione così possono prepararsi."],
        'de': ["{name} heißt Hunde willkommen — erwähne es bei der Buchung, damit man sich vorbereiten kann."],
    },
    'dogRifNo': {
        'en': ["{name} doesn't accept dogs, I'm afraid. If you're hiking with your dog, I can suggest an alternative."],
        'it': ["{name} non accetta cani, mi dispiace. Se cammini con il tuo cane, posso suggerirti un'alternativa."],
        'de': ["{name} nimmt leider keine Hunde. Wenn du mit deinem Hund unterwegs bist, kann ich dir eine Alternative vorschlagen."],
    },
    'dogRifUnknown': {
        'en': ["I'm not sure whether {name} accepts dogs — give them a call to confirm before you arrive."],
        'it': ["Non sono sicura se {name} accetti i cani — chiamali per conferma prima di arrivare."],
        'de': ["Ich bin nicht sicher, ob {name} Hunde akzeptiert — ruf vor der Anreise zur Bestätigung an."],
    },

    # ── Family / kids ───────────────────────────────────────────────────────
    'famTrailYes': {
        'en': ["{name} is family-friendly — great choice for a day out with kids. It's rated {diff}, so even younger hikers should manage well."],
        'it': ["{name} è adatto alle famiglie — un'ottima scelta per una giornata con i bambini. È classificato {diff}, quindi anche i piccoli escursionisti dovrebbero cavarsela bene."],
        'de': ["{name} ist familienfreundlich — eine tolle Wahl für einen Tag mit Kindern. Er ist als {diff} eingestuft, also kommen auch jüngere Wanderer gut zurecht."],
    },
    'famTrailNo': {
        'en': ["{name} isn't really suitable for young children — the terrain is {diff} and can be challenging for little legs."],
        'it': ["{name} non è proprio adatto ai bambini piccoli — il terreno è {diff} e può essere impegnativo per le gambe corte."],
        'de': ["{name} ist für kleine Kinder nicht wirklich geeignet — das Gelände ist {diff} und kann für kurze Beine anstrengend sein."],
    },
    'famTrailUnknown': {
        'en': ["I don't have family-suitability info for {name} specifically — the {diff} rating gives you a rough idea."],
        'it': ["Non ho informazioni specifiche sull'idoneità alle famiglie per {name} — la classificazione {diff} ti dà un'idea di massima."],
        'de': ["Ich habe für {name} keine spezifische Familien-Eignung — die Einstufung {diff} gibt dir einen groben Anhaltspunkt."],
    },
    'famRifugio': {
        'en': ["{name} should be fine for families — rifugios are used to all ages. Call ahead to check facilities for kids."],
        'it': ["{name} dovrebbe andar bene per le famiglie — i rifugi sono abituati a tutte le età. Chiama prima per verificare i servizi per i bambini."],
        'de': ["{name} sollte für Familien passen — Hütten sind alle Altersgruppen gewohnt. Ruf vorher an, um die Einrichtungen für Kinder zu prüfen."],
    },

    # ── Prices / stay ───────────────────────────────────────────────────────
    'priceRifugio': {
        'en': ["{name}: {prices}.{beds} Contact them directly to confirm availability."],
        'it': ["{name}: {prices}.{beds} Contattali direttamente per confermare la disponibilità."],
        'de': ["{name}: {prices}.{beds} Kontaktiere sie direkt, um die Verfügbarkeit zu bestätigen."],
    },
    'priceBeds': {
        'en': [" They have {beds} beds, so book early."],
        'it': [" Hanno {beds} posti letto, quindi prenota presto."],
        'de': [" Sie haben {beds} Betten, also buche früh."],
    },
    'priceNone': {
        'en': ["pricing not in my notes"],
        'it': ["prezzi non presenti nei miei appunti"],
        'de': ["Preise nicht in meinen Notizen"],
    },
    'priceOvernight': {
        'en': ["overnight €{v}"], 'it': ["pernottamento €{v}"], 'de': ["Übernachtung €{v}"],
    },
    'priceHalfBoard': {
        'en': ["half board €{v}"], 'it': ["mezza pensione €{v}"], 'de': ["Halbpension €{v}"],
    },
    'priceBreakfast': {
        'en': ["breakfast €{v}"], 'it': ["colazione €{v}"], 'de': ["Frühstück €{v}"],
    },
    'priceDinner': {
        'en': ["dinner €{v}"], 'it': ["cena €{v}"], 'de': ["Abendessen €{v}"],
    },
    'priceTrail': {
        'en': ["Prices for trails are free to walk — you're asking about the wrong kind of spend! Did you mean a rifugio nearby?"],
        'it': ["Camminare sui sentieri è gratis — stai chiedendo del tipo di spesa sbagliato! Forse intendevi un rifugio nelle vicinanze?"],
        'de': ["Wege zu gehen ist kostenlos — du fragst nach der falschen Art von Ausgabe! Meintest du vielleicht eine Hütte in der Nähe?"],
    },

    # ── Transport / bus / parking ───────────────────────────────────────────
    'transportInfo': {
        'en': ["Getting to {name} — {parts}"],
        'it': ["Per arrivare a {name} — {parts}"],
        'de': ["Anreise zu {name} — {parts}"],
    },
    'transportBus': {
        'en': ["By bus: {v}"], 'it': ["In autobus: {v}"], 'de': ["Mit dem Bus: {v}"],
    },
    'transportCar': {
        'en': ["By car: {v}"], 'it': ["In auto: {v}"], 'de': ["Mit dem Auto: {v}"],
    },
    'transportNone': {
        'en': ["I don't have transport details for {name} in my notes yet. Check the trail map in the app or search 'sad.it' for bus timetables in South Tyrol."],
        'it': ["Non ho ancora i dettagli sui trasporti per {name} nei miei appunti. Controlla la mappa del sentiero nell'app o cerca su 'sad.it' gli orari dei bus in Alto Adige."],
        'de': ["Ich habe noch keine Verkehrsdetails für {name} in meinen Notizen. Prüf die Wegkarte in der App oder such auf 'sad.it' nach Busfahrplänen in Südtirol."],
    },

    # ── Crowding ────────────────────────────────────────────────────────────
    'crowdInfo': {
        'en': ["{name} typically sees {level} visitor numbers, with the busiest period in {peak}.{tip}"],
        'it': ["{name} registra in genere un'affluenza {level}, con il periodo di punta in {peak}.{tip}"],
        'de': ["{name} hat in der Regel {level} Besucherzahlen, mit der Hauptzeit im {peak}.{tip}"],
    },
    'crowdTip': {
        'en': [" My tip: {tip}"],
        'it': [" Il mio consiglio: {tip}"],
        'de': [" Mein Tipp: {tip}"],
    },
    'crowdNone': {
        'en': ["I don't have crowd information for {name} in my data. Generally, South Tyrol trails are busiest in July and August — weekday mornings are always quieter."],
        'it': ["Non ho informazioni sull'affluenza per {name} nei miei dati. In generale, i sentieri dell'Alto Adige sono più affollati a luglio e agosto — le mattine infrasettimanali sono sempre più tranquille."],
        'de': ["Ich habe für {name} keine Besucherdaten. Generell sind die Südtiroler Wege im Juli und August am vollsten — Werktagvormittage sind immer ruhiger."],
    },

    # ── Recovery routing (multi-day exits, SAFETY) ──────────────────────────
    'recoveryStage': {
        'en': ["No problem — for {adv}, Stage {stage}: {desc} Transport: {transport}.{rejoin}"],
        'it': ["Nessun problema — per {adv}, Tappa {stage}: {desc} Trasporto: {transport}.{rejoin}"],
        'de': ["Kein Problem — für {adv}, Etappe {stage}: {desc} Transport: {transport}.{rejoin}"],
    },
    'recoveryRejoin': {
        'en': [" To get back on trail, you have two options: {options}"],
        'it': [" Per rientrare sul percorso hai due opzioni: {options}"],
        'de': [" Um wieder auf den Weg zu kommen, hast du zwei Möglichkeiten: {options}"],
    },
    'tipConnector': {
        'en': [" — and one thing I always mention: {tip}"],
        'it': [" — e una cosa che dico sempre: {tip}"],
        'de': [" — und eine Sache, die ich immer erwähne: {tip}"],
    },
    'recoveryGeneric': {
        'en': ["For emergency exits and recovery routing on a multi-day adventure, the key rule is: follow any red-white-red marked path downhill to the nearest valley. Then call mountain rescue (118) or SAD transport (sad.it). Tell me which specific adventure and day you're on and I'll give you precise options."],
        'it': ["Per le uscite d'emergenza e il rientro su un'avventura di più giorni, la regola fondamentale è: segui un qualsiasi sentiero con segnavia bianco-rosso-bianco scendendo verso la valle più vicina. Poi chiama il soccorso alpino (118) o i trasporti SAD (sad.it). Dimmi quale avventura e quale giorno stai affrontando e ti do opzioni precise."],
        'de': ["Für Notausstiege und Rückwege auf einer mehrtägigen Tour gilt die wichtigste Regel: folge einem rot-weiß-rot markierten Weg bergab ins nächste Tal. Ruf dann die Bergrettung (118) oder den SAD-Verkehr (sad.it) an. Sag mir, welche Tour und welchen Tag du gehst, und ich gebe dir genaue Optionen."],
    },
}
