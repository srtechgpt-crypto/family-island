// v12 화면: 꾸미기 창 탭(가구·벽지/바닥·세트), 색칠·전시, 마당 꾸미기 버튼, 하트, 이 주의 꾸미기 대회
import { state } from "../state.js";
import { iconHtml } from "../game/sprites.js";
import * as P from "../services/playerStore.js";
import * as D from "../services/decorStore.js";
import { isConnected, serverNow } from "../services/fb.js";
import { layerOf } from "../domain/placement.js";
import { setRoomStyle, roomStyleOf, ownsStyle, paintFurn, setShow, showKind, showable, setProgress, claimSet, contestResult, claimContest, heartTotal, weekKey, kstDay } from "../domain/decor.js";
import { nameOf, familyOf } from "../config/gameConfig.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MIDS = ["m0", "m1", "m2", "m3", "m4", "m5"];
const LAY = { rug: "러그", wall: "벽", top: "탁자 위", path: "길", yard: "마당" };
const FL = { red: "🌹", yellow: "🌼", white: "🤍", pink: "🌸", orange: "🏵️", purple: "💜", blue: "🔷", gold: "🌟" };

export function installV12(UI) {
  const proto = UI.prototype;
  const baseIcon = proto.furnIcon;
  // 새 가구는 도트 그림을 아이콘으로
  proto.furnIcon = function (t) {
    const d = this.data.furniture[t];
    if (d && d.flower) return FL[d.flower] || "🌷";
    if (d && (d.layer || ["lamp_floor", "lamp_lantern", "trophy_contest", "rosette_set"].includes(t))) return `<img class="pxi" style="width:1.4em;height:1.4em" src="art/furn/${t}.png" alt="">`;
    return baseIcon.call(this, t);
  };

  proto.bindV12 = function () {
    $("bYard").onclick = () => { if (this.game && this.game.startYardDeco()) { this._decoTab = "furn"; this.decoRefresh(); $("pDeco").hidden = false; $("bYard").hidden = true; } };
    $("bHeart").onclick = () => this.sendHeart();
    $("bContest").onclick = () => this.openContest();
    setInterval(() => this.updateV12Buttons(), 700);
  };
  proto.v12Refresh = function () { this.updateV12Buttons(); if (!$("pContest").hidden) this.openContest(); };
  proto.updateV12Buttons = function () {
    const g = this.game; if (!g || !g.d12) return;
    $("bYard").hidden = !(g.mode === "island" && !g.deco && !g.houseL.move && g.d12.nearMyYard());
    const visiting = g.mode === "house" && g.houseMid !== state.mid;
    if (g.mode === "house") {
      const owner = g.houseMid, total = heartTotal(D.heartsOf(owner));
      $("bHeart").hidden = false;
      if (!visiting) { $("bHeart").textContent = `♥ ${total}`; $("bHeart").disabled = true; }
      else { const mine = D.myHeartTo(owner), today = mine && mine.day >= kstDay(serverNow()); $("bHeart").textContent = today ? `♥ ${total} 고마워요` : `♥ 좋아요 (${total})`; $("bHeart").disabled = !!today; }
    } else $("bHeart").hidden = true;
  };
  proto.sendHeart = async function () {
    const g = this.game; if (!g || g.mode !== "house" || g.houseMid === state.mid) return;
    if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
    this.busy(true);
    const r = await D.sendHeart(g.houseMid).catch(() => ({ ok: false, reason: "저장 실패" }));
    this.busy(false);
    this.toast(r.ok ? `💗 ${nameOf(g.houseMid)}네 집에 하트를 보냈어요!` : r.reason);
    if (r.ok && g.d12) g.d12.heartFx = performance.now();
    this.updateV12Buttons();
  };

  // ---- 꾸미기 창(탭) ----
  const baseClose = proto.decoClose;
  proto.decoClose = function () { const yard = this.game && this.game.deco && this.game.deco.yard; baseClose.call(this); $("decoExtra").innerHTML = ""; if (yard) this.updateV12Buttons(); };
  proto.decoRefresh = function () {
    const g = this.game; if (!g || !g.deco) return;
    const yard = !!g.deco.yard, defs = this.data.furniture, p = state.player;
    const tab = yard ? "furn" : (this._decoTab || "furn");
    $("decoTitle").textContent = yard ? "🌷 마당 꾸미기" : "꾸미기";
    $("decoTabs").innerHTML = yard ? "" : [["furn", "🪑 가구"], ["style", "🖼️ 벽지·바닥"], ["set", "🎁 세트"]].map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${k === tab}">${l}</button>`).join("");
    $("decoTabs").querySelectorAll("button").forEach(b => b.onclick = () => { this._decoTab = b.dataset.t; g.deco.sel = null; g.deco.picked = null; this.decoRefresh(); });
    $("decoExtra").innerHTML = "";
    $("decoPick").hidden = true;
    if (tab === "style") return this.decoStyleTab();
    if (tab === "set") return this.decoSetTab();
    const isYardT = t => ["yard", "path"].includes(layerOf(defs, t));
    const hidden = yard ? g.d12.hiddenMine() : [];
    const list = Object.entries(p.furn).filter(([id, f]) => (f.state === "stored" || hidden.includes(id)) && (yard ? isYardT(f.type) : !isYardT(f.type)));
    const picked = g.deco.picked && p.furn[g.deco.picked];
    const where = yard ? "마당" : "방바닥";
    $("decoHint").textContent = g.deco.sel ? `놓을 자리를 ${where}에서 눌러요${yard ? " (하얀 칸)" : ""}` : picked ? "고른 것을 어떻게 할까요?" : yard ? "놓을 것을 고르거나, 마당에 있는 것을 눌러요" : "놓을 가구를 고르거나, 방에 있는 가구를 눌러요";
    $("decoGrid").innerHTML = list.length ? list.map(([id, f]) => {
      const L = layerOf(defs, f.type), tag = LAY[L] && L !== "yard" ? `<i>${LAY[L]}</i>` : "", miss = hidden.includes(id);
      return `<button type="button" class="cell lay${g.deco.sel === id ? " sel" : ""}${miss ? " miss" : ""}" data-f="${id}">${tag}<b>${this.furnIcon(f.type)}</b>${esc((defs[f.type] || { name: f.type }).name)}${miss ? "<small>자리 없음</small>" : ""}</button>`;
    }).join("") : `<p class="note">${yard ? "마당에 놓을 것이 없어요. 거실 작업대에서 벤치·화단·꽃 심기·길을 만들어요." : "가방에 놓을 가구가 없어요. 거실 작업대(망치)에서 만들어요."}</p>`;
    $("decoGrid").querySelectorAll("[data-f]").forEach(b => b.onclick = () => { g.deco.picked = null; g.decoSelect(g.deco.sel === b.dataset.f ? null : b.dataset.f); this.decoRefresh(); });
    if (!picked) return;
    $("decoPick").hidden = false;
    const L = layerOf(defs, picked.type);
    $("decoRot").hidden = L === "wall" || L === "top";
    $("decoShow").hidden = !showKind(defs, picked.type);
    $("decoPaint").hidden = !!(defs[picked.type] && defs[picked.type].flower);   // ⑦ 꽃은 색칠 없음
    $("decoMove").onclick = () => { g.deco.sel = g.deco.picked; g.deco.picked = null; this.decoRefresh(); };
    $("decoRot").onclick = async () => {
      if (yard) { this.busy(true); const r = await g.d12.yardRotate(g.deco.picked); this.busy(false); if (!r.ok) this.toast("돌릴 수 없어요 (" + (r.reason || "") + ")"); this.decoRefresh(); return; }
      const room = this.data.rooms[g.room], pf = p.furn[g.deco.picked];
      if (pf && L === "floor" && g.coversMe(pf.type, pf.x, pf.y, ((pf.rot || 0) + 1) % 4)) { this.toast("캐릭터가 서 있는 자리예요"); return; }
      this.busy(true); const r = await P.rotateFurniture(room, defs, g.deco.picked).catch(() => ({ ok: false })); this.busy(false);
      if (!r.ok) this.toast("돌릴 수 없어요 (" + (r.reason || "") + ")"); this.decoRefresh();
    };
    $("decoStore").onclick = async () => { const deco = g.deco, id = deco.picked; this.busy(true); const r = await P.storeFurniture(id, defs).catch(() => ({ ok: false })); this.busy(false); if (!r.ok) this.toast("넣지 못했어요"); else if (g.deco === deco && deco.picked === id) deco.picked = null; this.decoRefresh(); };
    $("decoPaint").onclick = () => this.decoPaintRow(g.deco.picked);
    $("decoShow").onclick = () => this.decoShowRow(g.deco.picked);
  };
  proto.decoPaintRow = function (id) {
    const p = state.player, f = p.furn[id], dyes = this.data.farm.dyes; if (!f) return;
    $("decoExtra").innerHTML = `<p class="note">물감 1개로 색을 입혀요 (가방의 물감 수)</p><div class="paints">${dyes.map((d, i) => { const n = p.inv["paint_" + d.id] || 0; return `<button type="button" data-i="${i}" style="background:${d.color}" ${n ? "" : "disabled"} title="${esc(d.name)}">${f.tint === i ? "✔" : n}</button>`; }).join("")}<button type="button" data-i="-1" style="background:#fff" title="원래 색">↺</button></div>`;
    $("decoExtra").querySelectorAll("[data-i]").forEach(b => b.onclick = async () => {
      this.busy(true); const r = await P.decorTx(pl => paintFurn(pl, id, +b.dataset.i, this.data.farm.dyes, this.data.furniture)).catch(() => ({ ok: false })); this.busy(false);
      if (!r.ok) this.toast(r.reason || "칠하지 못했어요"); else if (r.changed !== false) this.toast("🎨 색을 칠했어요!");
      this.decoPaintRow(id);
    });
  };
  proto.decoShowRow = function (id) {
    const p = state.player, f = p.furn[id], kind = f && showKind(this.data.furniture, f.type); if (!kind) return;
    const list = showable(p, kind), items = this.data.items;
    $("decoExtra").innerHTML = list.length ? `<p class="note">도감에 있는 ${kind === "fish" ? "물고기" : "곤충"} 중에서 골라요</p><div class="grid">${list.map(k => `<button type="button" class="cell${f.show === k ? " sel" : ""}" data-s="${k}"><b>${iconHtml(k, (items[k] || {}).icon)}</b>${esc((items[k] || { name: k }).name)}</button>`).join("")}<button type="button" class="cell" data-s=""><b>✖</b>비우기</button></div>`
      : `<p class="note">아직 도감에 ${kind === "fish" ? "물고기" : "곤충"}가 없어요. 먼저 잡아 봐요!</p>`;
    $("decoExtra").querySelectorAll("[data-s]").forEach(b => b.onclick = async () => {
      this.busy(true); const r = await P.decorTx(pl => setShow(pl, id, b.dataset.s || null, this.data.furniture)).catch(() => ({ ok: false })); this.busy(false);
      if (!r.ok) this.toast(r.reason || "바꾸지 못했어요"); this.decoShowRow(id);
    });
  };
  proto.decoStyleTab = function () {
    const g = this.game, p = state.player, decor = this.data.decor, room = this.data.rooms[g.room], cur = roomStyleOf(p, g.room, decor);
    $("decoHint").textContent = `${room.name}의 벽지와 바닥을 골라요 (두루마리는 작업대에서 만들고, 한 번 만들면 계속 써요)`;
    const sw = (kind, list) => `<div class="sw">${list.map((s, i) => { const own = ownsStyle(p, kind, i, decor); return `<button type="button" data-k="${kind}" data-i="${i}" aria-pressed="${cur[kind] === i}" ${own ? "" : "disabled"} style="background:${s.pat === "check" && i ? `repeating-conic-gradient(${s.a} 0 25%, ${s.b} 0 50%) 0 0/18px 18px` : `linear-gradient(135deg, ${s.a} 60%, ${s.b})`}">${own ? esc(s.name) : "🔒"}</button>`; }).join("")}</div>`;
    $("decoGrid").innerHTML = `<div style="grid-column:1/-1"><b>벽지</b>${sw("wall", decor.walls)}<b>바닥</b>${sw("floor", decor.floors)}</div>`;
    $("decoGrid").querySelectorAll("[data-k]").forEach(b => b.onclick = async () => {
      const roomId = g.room; this.busy(true);
      const r = await P.decorTx(pl => setRoomStyle(pl, roomId, b.dataset.k, +b.dataset.i, decor)).catch(() => ({ ok: false })); this.busy(false);
      if (!r.ok) this.toast(r.reason || "바꾸지 못했어요"); this.decoRefresh();
    });
  };
  proto.decoSetTab = function () {
    const p = state.player, defs = this.data.furniture, sets = this.data.sets;
    $("decoHint").textContent = "세트 가구를 하나씩 모두 모으면 '세트 완성 리본'을 받아요";
    $("decoGrid").innerHTML = `<div style="grid-column:1/-1">${sets.sets.map(s => {
      const pr = setProgress(p, s);
      const icons = s.types.map(t => `<span title="${esc(defs[t].name)}" style="opacity:${pr.have.includes(t) ? 1 : .3}">${this.furnIcon(t)}</span>`).join(" ");
      const btn = pr.got ? `<span class="ok">✅ 받았어요</span>` : pr.done ? `<button class="btn" type="button" data-set="${s.id}">리본 받기</button>` : `<small>${pr.have.length}/${s.types.length}</small>`;
      return `<div class="setRow"><div class="txt"><b>${esc(s.name)}</b><small>${icons}</small></div>${btn}</div>`;
    }).join("")}</div>`;
    $("decoGrid").querySelectorAll("[data-set]").forEach(b => b.onclick = async () => {
      const s = sets.sets.find(x => x.id === b.dataset.set); this.busy(true);
      const r = await P.decorTx(pl => claimSet(pl, s, sets.reward)).catch(() => ({ ok: false })); this.busy(false);
      this.toast(r.ok ? "🎀 세트 완성! 리본을 가방에 넣었어요" : (r.reason || "받지 못했어요")); this.decoRefresh();
    });
  };

  // ---- 이 주의 꾸미기 대회 ----
  proto.openContest = function () {
    const g = this.game, wk = D.thisWeek(), cfg = this.data.contest, rooms = this.data.rooms;
    const cur = D.contestOf(wk), last = D.contestOf(wk - 1), theme = cfg.themes[((wk % cfg.themes.length) + cfg.themes.length) % cfg.themes.length];
    const entries = cur.entry || {}, votes = D.votesOf(cur), myVote = votes[state.mid];
    $("ctSub").innerHTML = `이번 주 주제: <b>「${esc(theme)}」</b> — 우리 집 방 하나를 내고, 가족 방에 투표해요. 월요일에 1등이 트로피를 받아요.`;
    const inMine = g && g.mode === "house" && g.houseMid === state.mid;
    const mine = entries[state.mid];
    let html = `<div class="ctRow"><div class="txt"><b>내 출품</b><small>${mine ? `${esc(rooms[mine.room].name)}을(를) 냈어요` : "아직 안 냈어요"}${inMine ? "" : " · 우리 집 안에서 낼 수 있어요"}</small></div>${inMine ? `<button class="btn" type="button" id="ctEnter">지금 ${esc(rooms[g.room].name)} 내기</button>` : ""}</div>`;
    const count = contestResult(entries, votes).count;
    const list = MIDS.filter(m => entries[m]);
    html += list.length ? list.map(m => `<div class="ctRow"><div class="txt"><b style="color:${familyOf(m).color}">${esc(nameOf(m))}</b> · ${esc(rooms[entries[m].room] ? rooms[entries[m].room].name : "")}<small>표 ${count[m] || 0}개 · ♥ ${heartTotal(D.heartsOf(m))}</small></div><button class="btn ghost" type="button" data-visit="${m}">구경 가기</button>${m === state.mid ? "" : `<button class="btn${myVote === m ? "" : " ghost"}" type="button" data-vote="${m}">${myVote === m ? "✔ 투표함" : "투표"}</button>`}</div>`).join("")
      : `<p class="note">아직 아무도 안 냈어요. 처음으로 내 볼까요?</p>`;
    // 지난주 결과·상품
    const lastRes = contestResult(last.entry, D.votesOf(last));
    if (lastRes.winners.length) {
      const won = lastRes.winners.includes(state.mid), got = state.player && state.player.done["c_" + weekKey(wk - 1)];
      html += `<div class="ctRow"><div class="txt"><b>🏆 지난주 1등</b><small>${lastRes.winners.map(m => esc(nameOf(m))).join(", ")}</small></div>${won ? (got ? `<span class="ok">✅ 트로피 받음</span>` : `<button class="btn" type="button" id="ctPrize">트로피 받기</button>`) : ""}</div>`;
    }
    $("ctBody").innerHTML = html;
    if ($("ctEnter")) $("ctEnter").onclick = async () => { if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; } this.busy(true); try { await D.enterContest(g.room); this.toast("🏆 냈어요! 가족들이 구경 와서 투표할 거예요"); } catch { this.toast("내지 못했어요"); } this.busy(false); this.openContest(); };
    $("ctBody").querySelectorAll("[data-vote]").forEach(b => b.onclick = async () => { this.busy(true); try { await D.vote(b.dataset.vote); } catch { this.toast("투표하지 못했어요"); } this.busy(false); this.openContest(); });
    $("ctBody").querySelectorAll("[data-visit]").forEach(b => b.onclick = () => { const m = b.dataset.visit, e = entries[m]; $("pContest").hidden = true; this.game.visitRoom(m, e.room); });
    if ($("ctPrize")) $("ctPrize").onclick = async () => {
      if (!isConnected()) { this.toast("인터넷 연결을 기다리는 중이에요"); return; }
      this.busy(true); const lw = weekKey(wk - 1);
      const fresh = await D.fetchContest(wk - 1).catch(() => null);   // ⑦ 화면에 남은 옛 값이 아니라 서버의 마감된 결과로
      const r = fresh ? await P.decorTx(pl => claimContest(pl, lw, state.mid, fresh.entry, D.votesOf(fresh), cfg.reward)).catch(() => ({ ok: false })) : { ok: false, reason: "결과를 못 읽었어요" };
      this.busy(false);
      this.toast(r.ok ? "🏆 트로피를 가방에 넣었어요!" : (r.reason || "받지 못했어요")); this.openContest();
    };
    $("pContest").hidden = false;
  };
}
