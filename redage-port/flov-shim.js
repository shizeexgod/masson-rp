// Masson RP — прослойка совместимости RedAge (RAGE:MP) → FloV:MP.
// Подключается первой строкой в client_packages/index.js. Каждый кусок страхуется try/catch:
// прослойка ничего не ломает, если FloV:MP уже даёт нужное.
// Основание — отчёт мигратора (вызовы, которых нет в FloV:MP): mp.version.core, mp.dist,
// mp.players.local.setPosition (sit.js, «client.seat.yes»).

try {
    // damageController.js: "0.2 beta" == mp.version.core — без mp.version строка упадёт TypeError.
    if (typeof mp.version !== 'object' || mp.version === null) mp.version = {};
    if (mp.version.core === undefined) mp.version.core = '';
} catch (e) { }

try {
    // Расстояние между двумя точками (шесть чисел) — как в src_client/player/damage/test.js.
    if (typeof mp.dist !== 'function') {
        mp.dist = (x1, y1, z1, x2, y2, z2) => Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    }
} catch (e) { }

try {
    // sit.js: mp.players.local.setPosition(new mp.Vector3(x, y, z)) — телепорт без смещения.
    const proto = Object.getPrototypeOf(mp.players.local);
    if (proto && typeof proto.setPosition !== 'function') {
        proto.setPosition = function (v, y, z) {
            const p = (v !== null && typeof v === 'object') ? v : { x: v, y: y, z: z };
            this.setCoordsNoOffset(p.x, p.y, p.z, false, false, false);
        };
    }
} catch (e) { }

try {
    // world/stream.js: object.hasVariable('furniture') — у объектов FloV:MP нет hasVariable (ошибка playerReady из client_tc).
    if (typeof Object.prototype.hasVariable !== 'function') {
        Object.defineProperty(Object.prototype, 'hasVariable', {
            configurable: true, writable: true, enumerable: false,
            value: function (key) {
                try { const v = this.getVariable(key); return v !== undefined && v !== null; } catch (e) { return false; }
            },
        });
    }
} catch (e) { }

try {
    // Сборка больших событий сервера, нарезанных на части (см. MassonChunk в Trigger.cs): [id, номер, всего, имя события, часть].
    const massonParts = {};
    mp.events.add('masson.chunk', function (id, index, total, name, part) {
        try {
            const c = massonParts[id] || (massonParts[id] = { parts: [], got: 0, total: total, name: '', at: Date.now() });
            if (name) c.name = name;
            if (c.parts[index] === undefined) { c.parts[index] = part; c.got++; }
            if (c.got >= c.total) {
                delete massonParts[id];
                const args = JSON.parse(c.parts.join(''));
                mp.events.call(c.name, ...args);
            }
        } catch (e) { console.log('[MASSON] masson.chunk: ' + e); }
    });
} catch (e) { }
