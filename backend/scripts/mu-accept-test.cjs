/*
 * Multi-user-per-org acceptance test (staging).
 *
 * Proves the operator-directed contract on real services (no LLM / MinIO /
 * embeddings needed — RAG check uses the FTS leg):
 *   - INVITE/JOIN + SEAT CAP: an invite joins the SAME firm; the cap blocks the
 *     (maxSeats+1)th member.
 *   - DOCUMENTS = ORG-SHARED: user B sees user A's document AND RAG-retrieves a
 *     chunk from it.
 *   - CHAT = USER-PRIVATE: user B does NOT see user A's chat session/messages.
 *
 * Run inside the staging app pod:
 *   kubectl exec -i <pod> -c app -- sh -c 'cd /app/backend && NODE_PATH=/app/backend/node_modules node scripts/mu-accept-test.cjs'
 * Exits 0 on GREEN, 1 on RED. Creates + deletes its own throwaway data.
 */
(async () => {
  const { NestFactory } = require('/app/backend/node_modules/@nestjs/core');
  const { AppModule } = require('/app/backend/dist/app.module');
  const { PrismaService } = require('/app/backend/dist/prisma/prisma.service');
  const { AuthService } = require('/app/backend/dist/auth/auth.service');
  const { ChatService } = require('/app/backend/dist/chat/chat.service');
  const { DocumentsService } = require('/app/backend/dist/documents/documents.service');
  const { SemanticSearchService } = require('/app/backend/dist/search/search.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  // strict:false — these live in feature modules, not the root context.
  const g = { strict: false };
  const prisma = app.get(PrismaService, g);
  const auth = app.get(AuthService, g);
  const chat = app.get(ChatService, g);
  const docs = app.get(DocumentsService, g);
  const search = app.get(SemanticSearchService, g);

  const tag = 'muaccept' + Date.now();
  const pw = process.env.MU_ACCEPT_PASSWORD || require('crypto').randomBytes(12).toString('base64url');
  const out = [];
  let pass = true;
  const fail = (m) => { pass = false; out.push('  ✗ ' + m); };
  const ok = (m) => out.push('  ✓ ' + m);
  let firmId;

  try {
    // --- Owner A + firm (an existing 1-user org) ---
    // Create owner A + firm directly (admin scope) — represents an onboarded org.
    const seed = await prisma.runAsAdmin(async (tx) => {
      const firm = await tx.firm.create({ data: { name: tag + '-firm' } });
      const ownerA = await tx.user.create({
        data: { email: tag + '-a@example.com', password: 'x', name: 'OwnerA', role: 'USER', firmId: firm.id },
      });
      return { firmId: firm.id, aId: ownerA.id };
    });
    firmId = seed.firmId;
    const aId = seed.aId;
    out.push(`firm=${firmId} ownerA=${aId}`);

    // --- COMMIT 2: invite/join existing firm ---
    const inv1 = await auth.createInvite(firmId, aId); // { token, maxSeats, usedSeats }
    const maxSeats = inv1.maxSeats;
    out.push(`maxSeats=${maxSeats}`);
    const bRes = await auth.signup({ email: tag + '-b@example.com', password: pw, name: 'MemberB', registrationToken: inv1.token });
    const bId = bRes.user.id;
    if (bRes.user.firmId === firmId) ok('invite JOINED member B to the same firm');
    else fail(`member B firmId=${bRes.user.firmId} != owner firm ${firmId} (invite did not join)`);

    // --- COMMIT 2: seat cap ---
    // Fill remaining seats up to maxSeats, then the next must be rejected.
    let n = await prisma.runAsAdmin((tx) => tx.user.count({ where: { firmId } }));
    let capError = null;
    let filledTo = n;
    while (n < maxSeats + 1) {
      const inv = await auth.createInvite(firmId, aId).catch((e) => ({ _err: e }));
      if (inv._err) { capError = inv._err.message; break; }
      try {
        await auth.signup({ email: `${tag}-fill${n}@example.com`, password: pw, registrationToken: inv.token });
        n++; filledTo = n;
      } catch (e) { capError = e.message; break; }
    }
    const finalCount = await prisma.runAsAdmin((tx) => tx.user.count({ where: { firmId } }));
    if (finalCount === maxSeats && capError && /full|max/i.test(capError)) {
      ok(`seat cap enforced: firm filled to ${finalCount}/${maxSeats}, next blocked ("${capError}")`);
    } else {
      fail(`seat cap NOT enforced: count=${finalCount} maxSeats=${maxSeats} capError=${capError}`);
    }

    // --- DOCUMENTS = ORG-SHARED: A's doc visible to B + RAG-retrievable ---
    const uniq = tag + 'kw';
    const docId = await prisma.runForFirm(firmId, async (tx) => {
      const d = await tx.document.create({
        data: {
          firmId, ownerUserId: aId,
          minioKey: `firms/${firmId}/${tag}/f.txt`, originalName: `${tag}.txt`,
          sizeBytes: 42, processingStatus: 'DONE', ocrText: `report mentioning ${uniq} revenue`,
        },
      });
      await tx.documentChunk.create({
        data: { firmId, documentId: d.id, chunkIndex: 0, text: `the distinctive keyword ${uniq} appears here` },
      });
      return d.id;
    });
    const listForFirm = await docs.list(firmId); // firm-scoped (not owner-scoped)
    if (listForFirm.some((x) => x.id === docId)) ok("member B sees owner A's document (org-shared list)");
    else fail("member B does NOT see owner A's document (list leaked to owner only)");
    let ragHit = false;
    try {
      const hits = await search.search(firmId, uniq, 5);
      ragHit = JSON.stringify(hits).includes(uniq);
    } catch (e) { out.push('  (search error: ' + e.message + ')'); }
    if (ragHit) ok('RAG/FTS retrieves a chunk from the shared document'); else fail('RAG did NOT retrieve the shared document chunk');

    // --- CHAT = USER-PRIVATE: A's chat hidden from B ---
    const sessionId = await prisma.runForUser(firmId, aId, async (tx) => {
      const s = await tx.chatSession.create({ data: { firmId, userId: aId, title: tag + '-A' } });
      await tx.conversationMessage.create({
        data: { firmId, userId: aId, sessionId: s.id, authorRole: 'USER', mode: 'FREE_CHAT', content: `A-private-${uniq}`, redactedContent: `A-private-${uniq}` },
      });
      return s.id;
    });
    const aSessions = await chat.listSessions(firmId, aId);
    const bSessions = await chat.listSessions(firmId, bId);
    const bMsgs = await chat.list(firmId, undefined, 50, sessionId, bId);
    if (aSessions.some((s) => s.id === sessionId)) ok('owner A sees own chat session (control)'); else fail('owner A cannot see own session (over-filtered)');
    if (!bSessions.some((s) => s.id === sessionId)) ok("member B does NOT see owner A's chat session"); else fail("member B SEES owner A's chat session (LEAK)");
    if (!bMsgs.some((m) => (m.content || '').includes(`A-private-${uniq}`))) ok("member B does NOT see owner A's messages"); else fail("member B SEES owner A's messages (LEAK)");

  } catch (e) {
    fail('exception: ' + (e && e.message));
  } finally {
    // Cleanup throwaway data.
    if (firmId) {
      await prisma.runAsAdmin(async (tx) => {
        await tx.conversationMessage.deleteMany({ where: { firmId } });
        await tx.chatSession.deleteMany({ where: { firmId } });
        await tx.documentChunk.deleteMany({ where: { firmId } });
        await tx.document.deleteMany({ where: { firmId } });
        await tx.registrationToken.deleteMany({ where: { firmId } });
        await tx.user.deleteMany({ where: { firmId } });
        await tx.firm.delete({ where: { id: firmId } }).catch(() => {});
      }).catch((e) => out.push('  (cleanup war: ' + e.message + ')'));
    }
    await app.close();
  }

  console.log(out.join('\n'));
  console.log(pass ? 'ACCEPTANCE=GREEN' : 'ACCEPTANCE=RED');
  process.exit(pass ? 0 : 1);
})();
