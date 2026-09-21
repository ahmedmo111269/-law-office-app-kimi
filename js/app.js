/* LawOffice - Application UI (SPA) */
(function (L) {
  'use strict';
  var U = L.Utils, R = L.Repo, C = L.Constants;
  var LK = {}; /* lookups cache: category -> [{id,name}] */

  function toast(msg, type) {
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'success');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3000);
  }
  L.toast = toast;

  function modal(opts) {
    return new Promise(function (res) {
      var ov = document.createElement('div');
      ov.className = 'modal-overlay';
      ov.innerHTML = '<div class="modal"><div class="modal-body">' + U.esc(opts.message || '') + '</div>' +
        '<div class="modal-actions">' +
        (opts.cancelText !== null ? '<button class="btn btn-ghost" data-act="cancel">' + U.esc(opts.cancelText || 'إلغاء') + '</button>' : '') +
        '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-act="ok">' + U.esc(opts.okText || 'تأكيد') + '</button>' +
        '</div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) {
        var act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'ok') { ov.remove(); res(true); }
        else if (act === 'cancel') { ov.remove(); res(false); }
      });
    });
  }
  L.confirm = modal;

  function errHandler(e, msg) { console.error(e); toast(msg || 'تعذر حفظ البيانات، حاول مرة أخرى', 'error'); }

  /* ---------- lookups ---------- */
  function loadLookups() {
    return R.lookups.all().then(function (rows) {
      LK = {};
      rows.forEach(function (r) { (LK[r.category] = LK[r.category] || []).push(r); });
      Object.keys(LK).forEach(function (k) {
        LK[k].sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
      });
      return LK;
    });
  }
  function lkName(cat, id) {
    var arr = LK[cat] || [];
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i].name;
    return '';
  }
  L.lkName = lkName;
  function lkOptions(cat, sel) {
    return (LK[cat] || []).filter(function (x) { return x.active; })
      .map(function (x) { return '<option value="' + U.esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + U.esc(x.name) + '</option>'; }).join('');
  }

  /* ---------- shared helpers ---------- */
  function caseTitle(cs) {
    if (!cs) return '';
    return cs.caseNumber + ' لسنة ' + cs.caseYear + (cs.court ? ' - ' + cs.court : '');
  }
  L.caseTitle = caseTitle;

  function caseClients(caseId) {
    return R.caseClients.byIndex('caseId', caseId).then(function (rels) {
      return Promise.all(rels.map(function (r) {
        return R.clients.get(r.clientId).then(function (cl) { return cl ? { rel: r, client: cl } : null; });
      })).then(function (arr) { return arr.filter(Boolean); });
    });
  }
  function caseOpponents(caseId) {
    return R.caseOpponents.byIndex('caseId', caseId).then(function (rels) {
      return Promise.all(rels.map(function (r) {
        return R.opponents.get(r.opponentId).then(function (op) { return op ? { rel: r, opponent: op } : null; });
      })).then(function (arr) { return arr.filter(Boolean); });
    });
  }
  function getCase(id) { return R.cases.get(id); }
  L.getCase = getCase;

  function emptyState(msg, addRoute, addLabel) {
    return '<div class="empty-state"><p>' + U.esc(msg) + '</p>' +
      (addRoute ? '<a class="btn btn-primary" href="' + addRoute + '">+ ' + U.esc(addLabel) + '</a>' : '') + '</div>';
  }
  function field(label, inner) { return '<div class="form-group"><label>' + U.esc(label) + '</label>' + inner + '</div>'; }
  function inp(id, val, type, ph) { return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + U.esc(val || '') + '" placeholder="' + U.esc(ph || '') + '">'; }

  /* ================= DASHBOARD ================= */
  function dashboard(view) {
    var t = U.today();
    Promise.all([
      R.clients.all(), R.cases.all(),
      R.hearings.byIndex('date', t),
      R.procedures.all()
    ]).then(function (a) {
      var clients = a[0], cases = a[1], todayH = a[2], procs = a[3];
      var activeClients = clients.filter(function (c) { return !c.archived; }).length;
      var activeCases = cases.filter(function (c) { return !c.archived; }).length;
      var overdue = procs.filter(function (p) {
        return p.deadline && p.deadline < t && p.statusId !== 'done' && p.statusId !== 'cancelled';
      });
      todayH.sort(function (x, y) { return (x.time || '') < (y.time || '') ? -1 : 1; });

      function card(num, label, href) {
        return '<a class="stat-card" href="' + href + '"><span class="stat-num">' + num + '</span><span class="stat-label">' + label + '</span></a>';
      }
      var html = '<div class="page-head"><h1>لوحة التحكم</h1></div>' +
        '<div class="quick-actions">' +
        '<a class="btn btn-primary" href="#/clients/new">+ عميل</a>' +
        '<a class="btn btn-primary" href="#/cases/new">+ قضية</a>' +
        '<a class="btn btn-primary" href="#/hearings/new">+ جلسة</a>' +
        '<a class="btn btn-primary" href="#/procedures/new">+ إجراء</a>' +
        '<a class="btn btn-primary" href="#/judgments/new">+ حكم</a>' +
        '</div>' +
        '<div class="stats-grid">' +
        card(activeClients, 'العملاء النشطون', '#/clients') +
        card(activeCases, 'القضايا النشطة', '#/cases') +
        card(todayH.length, 'جلسات اليوم', '#/hearings?range=today') +
        card(overdue.length, 'إجراءات متأخرة', '#/procedures?filter=overdue') +
        '</div>';

      html += '<section class="panel"><h2>جلسات اليوم (' + U.fmtDate(t) + ')</h2>';
      if (!todayH.length) html += emptyState('لا توجد جلسات اليوم');
      else html += '<ul class="item-list">' + todayH.map(function (h) {
        return '<li><a href="#/cases/' + h.caseId + '"><strong>' + U.esc(h.time || '') + '</strong> — ' +
          U.esc(h.court || '') + ' <span class="muted">' + U.esc(lkName('hearingType', h.hearingTypeId) || '') + '</span></a></li>';
      }).join('') + '</ul>';
      html += '</section>';

      html += '<section class="panel"><h2>إجراءات تحتاج إلى متابعة (' + overdue.length + ')</h2>';
      if (!overdue.length) html += emptyState('لا توجد إجراءات متأخرة');
      else html += '<ul class="item-list">' + overdue.slice(0, 10).map(function (p) {
        return '<li><a href="#/cases/' + p.caseId + '"><strong>' + U.esc(p.description || lkName('procedureType', p.typeId)) + '</strong>' +
          ' <span class="badge badge-danger">متأخر منذ ' + U.fmtDate(p.deadline) + '</span></a></li>';
      }).join('') + '</ul>';
      html += '</section>';
      view.innerHTML = html;
    }).catch(function (e) { errHandler(e); });
  }

  /* ================= CLIENTS ================= */
  function clientsList(view, params) {
    var q = (params && params.q) || '';
    var showArchived = params && params.arch === '1';
    R.clients.all().then(function (rows) {
      rows = rows.filter(function (c) { return !!c.archived === showArchived; });
      if (q) {
        var n = q.toLowerCase();
        rows = rows.filter(function (c) {
          return (c.fullName || '').toLowerCase().indexOf(n) > -1 ||
            (c.phone1 || '').indexOf(q) > -1 || (c.nationalId || '').indexOf(q) > -1 ||
            (c.whatsapp || '').indexOf(q) > -1;
        });
      }
      rows.sort(function (a, b) { return (a.fullName || '').localeCompare(b.fullName || '', 'ar'); });
      var html = '<div class="page-head"><h1>العملاء' + (showArchived ? ' (مؤرشفون)' : '') + '</h1>' +
        '<a class="btn btn-primary" href="#/clients/new">+ إضافة عميل</a></div>' +
        '<div class="filters"><input id="cl-q" placeholder="بحث بالاسم أو الهاتف أو الرقم القومي" value="' + U.esc(q) + '">' +
        '<label class="chk"><input type="checkbox" id="cl-arch"' + (showArchived ? ' checked' : '') + '> إظهار المؤرشفين</label></div>';
      if (!rows.length) html += emptyState('لا يوجد عملاء', '#/clients/new', 'إضافة عميل');
      else {
        html += '<div class="cards-grid">' + rows.map(function (c) {
          return '<div class="card">' +
            '<h3><a href="#/clients/' + c.id + '">' + U.esc(c.fullName) + '</a></h3>' +
            '<p>' + U.esc(c.phone1 || '') + '</p>' +
            '<div class="card-actions">' +
            '<a class="btn btn-sm" href="#/clients/' + c.id + '">فتح السجل</a>' +
            '<a class="btn btn-sm" href="#/clients/' + c.id + '/edit">تعديل</a>' +
            (c.archived
              ? '<button class="btn btn-sm" data-restore="' + c.id + '">استعادة</button>'
              : '<button class="btn btn-sm btn-danger" data-arch="' + c.id + '">أرشفة</button>') +
            '</div></div>';
        }).join('') + '</div>';
      }
      view.innerHTML = html;
      var iq = document.getElementById('cl-q');
      iq.addEventListener('input', U.debounce(function () {
        var p = { q: iq.value }; if (showArchived) p.arch = '1';
        render('clients', p);
      }, 300));
      document.getElementById('cl-arch').addEventListener('change', function (e) {
        var p = { q: iq.value }; if (e.target.checked) p.arch = '1';
        render('clients', p);
      });
      U.$$('[data-arch]').forEach(function (b) { b.addEventListener('click', function () {
        R.clients.get(b.getAttribute('data-arch')).then(function (c) {
          modal({ message: 'أرشفة العميل "' + c.fullName + '"؟ ستبقى قضاياه وبياناته محفوظة.', okText: 'أرشفة' }).then(function (ok) {
            if (!ok) return;
            c.archived = true; R.clients.put(c).then(function () { toast('تم أرشفة العميل'); render('clients', params); }).catch(errHandler);
          });
        });
      }); });
      U.$$('[data-restore]').forEach(function (b) { b.addEventListener('click', function () {
        R.clients.get(b.getAttribute('data-restore')).then(function (c) {
          c.archived = false; R.clients.put(c).then(function () { toast('تمت الاستعادة'); render('clients', params); }).catch(errHandler);
        });
      }); });
    }).catch(errHandler);
  }

  function clientForm(view, params, id) {
    var isEdit = !!id;
    var data = {};
    function draw() {
      view.innerHTML = '<div class="page-head"><h1>' + (isEdit ? 'تعديل عميل' : 'إضافة عميل') + '</h1></div>' +
        '<form id="f-client" class="form-panel">' +
        field('الاسم بالكامل *', inp('fullName', data.fullName)) +
        field('الرقم القومي', inp('nationalId', data.nationalId)) +
        field('الهاتف الأول', inp('phone1', data.phone1)) +
        field('الهاتف الثاني', inp('phone2', data.phone2)) +
        field('واتساب', inp('whatsapp', data.whatsapp)) +
        field('العنوان', inp('address', data.address)) +
        field('المهنة', inp('profession', data.profession)) +
        field('البريد الإلكتروني', inp('email', data.email, 'email')) +
        field('ملاحظات', '<textarea id="notes">' + U.esc(data.notes || '') + '</textarea>') +
        '<div class="form-actions"><button type="submit" class="btn btn-primary">حفظ</button>' +
        '<a class="btn btn-ghost" href="#/clients">إلغاء</a></div></form>';
      document.getElementById('f-client').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = {
          fullName: U.val('fullName'), nationalId: U.val('nationalId'),
          phone1: U.val('phone1'), phone2: U.val('phone2'), whatsapp: U.val('whatsapp'),
          address: U.val('address'), profession: U.val('profession'),
          email: U.val('email'), notes: U.val('notes'), archived: data.archived || false
        };
        if (!f.fullName) { toast('اسم العميل مطلوب', 'error'); return; }
        var p = isEdit ? R.clients.put(Object.assign({}, data, f)) : R.clients.add(f);
        p.then(function () { toast('تم الحفظ بنجاح'); location.hash = '#/clients'; }).catch(function (e2) { errHandler(e2); });
      });
    }
    if (isEdit) R.clients.get(id).then(function (c) { if (!c) { view.innerHTML = emptyState('العميل غير موجود'); return; } data = c; draw(); }).catch(errHandler);
    else draw();
  }

  function clientRecord(view, params, id) {
    Promise.all([R.clients.get(id), caseClients(id)]).then(function (a) {
      var c = a[0], rels = a[1];
      if (!c) { view.innerHTML = emptyState('العميل غير موجود'); return; }
      var caseIds = rels.map(function (r) { return r.rel.caseId; });
      Promise.all([
        Promise.all(caseIds.map(function (cid) { return R.cases.get(cid); })),
        R.hearings.all(), R.procedures.all(), R.judgments.all()
      ]).then(function (b) {
        var cases = b[0].filter(Boolean);
        var hearings = b[1].filter(function (h) { return caseIds.indexOf(h.caseId) > -1; });
        var procs = b[2].filter(function (p) { return caseIds.indexOf(p.caseId) > -1; });
        var judg = b[3].filter(function (j) { return caseIds.indexOf(j.caseId) > -1; });
        hearings.sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); });

        var html = '<div class="page-head"><h1>' + U.esc(c.fullName) + '</h1><div>' +
          '<a class="btn" href="#/clients/' + c.id + '/edit">تعديل</a> ' +
          (c.archived ? '<span class="badge">مؤرشف</span>' : '') + '</div></div>' +
          '<div class="breadcrumbs"><a href="#/clients">العملاء</a> / ' + U.esc(c.fullName) + '</div>' +
          '<section class="panel"><h2>بيانات العميل</h2><div class="detail-grid">' +
          dItem('الرقم القومي', c.nationalId) + dItem('الهاتف الأول', c.phone1) +
          dItem('الهاتف الثاني', c.phone2) + dItem('واتساب', c.whatsapp) +
          dItem('العنوان', c.address) + dItem('المهنة', c.profession) +
          dItem('البريد الإلكتروني', c.email) + dItem('ملاحظات', c.notes) +
          '</div></section>';

        html += '<section class="panel"><h2>القضايا (' + cases.length + ')</h2>';
        html += cases.length ? '<ul class="item-list">' + cases.map(function (cs) {
          var rel = rels.filter(function (r) { return r.rel.caseId === cs.id; })[0];
          return '<li><a href="#/cases/' + cs.id + '">' + U.esc(caseTitle(cs)) + '</a>' +
            (rel ? ' <span class="badge">' + U.esc(lkName('clientRole', rel.rel.role) || rel.rel.role || '') + '</span>' : '') + '</li>';
        }).join('') + '</ul>' : emptyState('لا توجد قضايا لهذا العميل');
        html += '<a class="btn btn-sm" href="#/cases/new?clientId=' + c.id + '">+ إضافة قضية</a></section>';

        html += '<section class="panel"><h2>الجلسات القادمة</h2>' +
          (hearings.filter(function (h) { return h.date >= U.today(); }).length
            ? '<ul class="item-list">' + hearings.filter(function (h) { return h.date >= U.today(); }).slice(0, 10).map(function (h) {
                return '<li><a href="#/cases/' + h.caseId + '">' + U.fmtDate(h.date) + ' ' + U.esc(h.time || '') + ' — ' + U.esc(h.court || '') + '</a></li>';
              }).join('') + '</ul>' : emptyState('لا توجد جلسات قادمة')) + '</section>';

        html += '<section class="panel"><h2>الإجراءات</h2>' +
          (procs.length ? '<ul class="item-list">' + procs.slice(0, 10).map(function (p) {
            return '<li><a href="#/cases/' + p.caseId + '">' + U.esc(p.description || lkName('procedureType', p.typeId)) + '</a></li>';
          }).join('') + '</ul>' : emptyState('لا توجد إجراءات')) + '</section>';

        html += '<section class="panel"><h2>الأحكام</h2>' +
          (judg.length ? '<ul class="item-list">' + judg.slice(0, 10).map(function (j) {
            return '<li><a href="#/cases/' + j.caseId + '">' + U.fmtDate(j.date) + ' — ' + U.esc(lkName('judgmentType', j.judgmentTypeId)) + '</a></li>';
          }).join('') + '</ul>' : emptyState('لا توجد أحكام')) + '</section>';

        view.innerHTML = html;
      }).catch(errHandler);
    }).catch(errHandler);
  }
  function dItem(k, v) { return v ? '<div class="detail-item"><span class="detail-key">' + U.esc(k) + '</span><span class="detail-val">' + U.esc(v) + '</span></div>' : ''; }
/* ================= CASES ================= */
  function casesList(view, params) {
    params = params || {};
    Promise.all([R.cases.all(), R.caseClients.all(), R.clients.all()]).then(function (a) {
      var rows = a[0], rels = a[1], clients = a[2];
      var clientName = {};
      clients.forEach(function (c) { clientName[c.id] = c.fullName; });
      function firstClient(cid) {
        var r = rels.filter(function (x) { return x.caseId === cid; })[0];
        return r ? (clientName[r.clientId] || '') : '';
      }
      rows = rows.filter(function (c) { return params.arch === '1' ? !!c.archived : !c.archived; });
      if (params.year) rows = rows.filter(function (c) { return String(c.caseYear) === params.year; });
      if (params.court) rows = rows.filter(function (c) { return (c.court || '').indexOf(params.court) > -1; });
      if (params.statusId) rows = rows.filter(function (c) { return c.caseStatusId === params.statusId; });
      if (params.typeId) rows = rows.filter(function (c) { return c.caseTypeId === params.typeId; });
      if (params.q) {
        var n = params.q.toLowerCase();
        rows = rows.filter(function (c) {
          return (c.caseNumber || '').toLowerCase().indexOf(n) > -1 ||
            (c.subject || '').toLowerCase().indexOf(n) > -1 ||
            (firstClient(c.id) || '').toLowerCase().indexOf(n) > -1;
        });
      }
      rows.sort(function (x, y) { return String(y.caseYear).localeCompare(String(x.caseYear)) || String(y.caseNumber).localeCompare(String(x.caseNumber), 'ar', { numeric: true }); });

      var html = '<div class="page-head"><h1>القضايا</h1><a class="btn btn-primary" href="#/cases/new">+ إضافة قضية</a></div>' +
        '<div class="filters">' +
        '<input id="cs-q" placeholder="بحث برقم القضية أو الموضوع أو العميل" value="' + U.esc(params.q || '') + '">' +
        '<input id="cs-year" placeholder="السنة" value="' + U.esc(params.year || '') + '" size="6">' +
        '<input id="cs-court" placeholder="المحكمة" value="' + U.esc(params.court || '') + '">' +
        '<select id="cs-type"><option value="">كل الأنواع</option>' + lkOptions('caseType', params.typeId) + '</select>' +
        '<select id="cs-status"><option value="">كل الحالات</option>' + lkOptions('caseStatus', params.statusId) + '</select>' +
        '<label class="chk"><input type="checkbox" id="cs-arch"' + (params.arch === '1' ? ' checked' : '') + '> مؤرشفة</label>' +
        '</div>';
      if (!rows.length) html += emptyState('لا توجد قضايا مطابقة', '#/cases/new', 'إضافة قضية');
      else {
        html += '<div class="table-wrap"><table><thead><tr><th>رقم القضية</th><th>السنة</th><th>النوع</th><th>درجة التقاضي</th><th>المحكمة</th><th>الدائرة</th><th>الحالة</th><th>العميل</th><th></th></tr></thead><tbody>' +
          rows.map(function (c) {
            return '<tr><td>' + U.esc(c.caseNumber) + '</td><td>' + U.esc(c.caseYear) + '</td>' +
              '<td>' + U.esc(lkName('caseType', c.caseTypeId)) + '</td>' +
              '<td>' + U.esc(lkName('litigationDegree', c.litigationDegreeId)) + '</td>' +
              '<td>' + U.esc(c.court || '') + '</td><td>' + U.esc(c.circuit || '') + '</td>' +
              '<td><span class="badge">' + U.esc(lkName('caseStatus', c.caseStatusId)) + '</span></td>' +
              '<td>' + U.esc(firstClient(c.id)) + '</td>' +
              '<td><a class="btn btn-sm" href="#/cases/' + c.id + '">فتح</a></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      view.innerHTML = html;
      function ref() {
        var p = {};
        ['q', 'year', 'court'].forEach(function (k) { var v = U.val('cs-' + k); if (v) p[k] = v; });
        if (U.val('cs-type')) p.typeId = U.val('cs-type');
        if (U.val('cs-status')) p.statusId = U.val('cs-status');
        if (document.getElementById('cs-arch').checked) p.arch = '1';
        render('cases', p);
      }
      ['cs-q', 'cs-year', 'cs-court'].forEach(function (i) { document.getElementById(i).addEventListener('input', U.debounce(ref, 300)); });
      ['cs-type', 'cs-status', 'cs-arch'].forEach(function (i) { document.getElementById(i).addEventListener('change', ref); });
    }).catch(errHandler);
  }

  function caseForm(view, params, id) {
    var isEdit = !!id, data = {}, selClients = {}, selOpps = {};
    function draw(clients, opponents) {
      var clientBoxes = clients.map(function (c) {
        var r = selClients[c.id];
        return '<label class="chk"><input type="checkbox" class="cs-client" value="' + c.id + '"' + (r ? ' checked' : '') + '> ' + U.esc(c.fullName) + '</label>' +
          (r ? ' <select class="role-sel" data-for="' + c.id + '"><option value="">الصفة...</option>' + lkOptions('clientRole', r.role) + '</select>' : '');
      }).join('') || '<p class="muted">لا يوجد عملاء — أضف عميلاً أولاً</p>';
      var oppBoxes = opponents.map(function (o) {
        var r = selOpps[o.id];
        return '<label class="chk"><input type="checkbox" class="cs-opp" value="' + o.id + '"' + (r ? ' checked' : '') + '> ' + U.esc(o.fullName) + '</label>' +
          (r ? ' <select class="role-sel" data-opp="' + o.id + '"><option value="">الصفة...</option>' + lkOptions('opponentRole', r.role) + '</select>' : '');
      }).join('') || '<p class="muted">لا يوجد خصوم مسجلون</p>';

      view.innerHTML = '<div class="page-head"><h1>' + (isEdit ? 'تعديل قضية' : 'إضافة قضية') + '</h1></div>' +
        '<form id="f-case" class="form-panel">' +
        '<div class="form-row">' + field('رقم القضية *', inp('caseNumber', data.caseNumber)) + field('لسنة *', inp('caseYear', data.caseYear, 'number')) + '</div>' +
        '<div class="form-row">' + field('نوع القضية', '<select id="caseTypeId">' + lkOptions('caseType', data.caseTypeId) + '</select>') +
        field('درجة التقاضي', '<select id="litigationDegreeId">' + lkOptions('litigationDegree', data.litigationDegreeId) + '</select>') + '</div>' +
        '<div class="form-row">' + field('المحكمة', inp('court', data.court)) + field('الدائرة', inp('circuit', data.circuit)) + '</div>' +
        field('الموضوع', '<textarea id="subject">' + U.esc(data.subject || '') + '</textarea>') +
        '<div class="form-row">' + field('حالة القضية', '<select id="caseStatusId">' + lkOptions('caseStatus', data.caseStatusId) + '</select>') +
        field('تاريخ القيد', inp('filingDate', data.filingDate, 'date')) + '</div>' +
        '<section class="panel"><h2>العملاء</h2><div class="checks">' + clientBoxes + '</div>' +
        '<a class="btn btn-sm" href="#/clients/new?ret=case">+ عميل جديد</a></section>' +
        '<section class="panel"><h2>الخصوم</h2><div class="checks">' + oppBoxes + '</div>' +
        '<a class="btn btn-sm" href="#/opponents/new?ret=case">+ خصم جديد</a></section>' +
        field('ملاحظات', '<textarea id="notes">' + U.esc(data.notes || '') + '</textarea>') +
        '<div class="form-actions"><button class="btn btn-primary" type="submit">حفظ</button>' +
        '<a class="btn btn-ghost" href="#/cases">إلغاء</a></div></form>';

      U.$$('.cs-client').forEach(function (cb) { cb.addEventListener('change', function () { selClients[cb.value] = cb.checked ? (selClients[cb.value] || {}) : null; draw(clients, opponents); }); });
      U.$$('.cs-opp').forEach(function (cb) { cb.addEventListener('change', function () { selOpps[cb.value] = cb.checked ? (selOpps[cb.value] || {}) : null; draw(clients, opponents); }); });
      U.$$('.role-sel[data-for]').forEach(function (s) { s.addEventListener('change', function () { selClients[s.getAttribute('data-for')].role = s.value; }); });
      U.$$('.role-sel[data-opp]').forEach(function (s) { s.addEventListener('change', function () { selOpps[s.getAttribute('data-opp')].role = s.value; }); });

      document.getElementById('f-case').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = {
          caseNumber: U.val('caseNumber'), caseYear: U.num('caseYear'),
          caseTypeId: U.val('caseTypeId'), litigationDegreeId: U.val('litigationDegreeId'),
          court: U.val('court'), circuit: U.val('circuit'), subject: U.val('subject'),
          caseStatusId: U.val('caseStatusId'), filingDate: U.val('filingDate'),
          notes: U.val('notes'), archived: data.archived || false
        };
        if (!f.caseNumber || !f.caseYear) { toast('رقم القضية والسنة مطلوبان', 'error'); return; }
        var caseId = isEdit ? id : U.uid();
        var cObj = Object.assign({}, data, f, { id: caseId });
        var rels = [];
        Object.keys(selClients).forEach(function (cid) { if (selClients[cid]) rels.push({ t: 'caseClients', caseId: caseId, clientId: cid, role: selClients[cid].role || '' }); });
        Object.keys(selOpps).forEach(function (oid) { if (selOpps[oid]) rels.push({ t: 'caseOpponents', caseId: caseId, opponentId: oid, role: selOpps[oid].role || '' }); });

        /* single transaction: case + replace relations */
        L.DB.open().then(function (db) {
          return new Promise(function (res, rej) {
            var t = db.transaction(['cases', 'caseClients', 'caseOpponents'], 'readwrite');
            t.objectStore('cases').put(cObj);
            ['caseClients', 'caseOpponents'].forEach(function (s) {
              var st = t.objectStore(s);
              reqp(st.index('caseId').getAllKeys ? st.index('caseId').getAll(caseId) : null).then(function (old) {
                (old || []).forEach(function (o) { st.delete(o.id); });
                rels.filter(function (r) { return r.t === s; }).forEach(function (r) {
                  st.add({ id: U.uid(), caseId: r.caseId, clientId: r.clientId, opponentId: r.opponentId, role: r.role, notes: '', createdAt: U.nowISO(), updatedAt: U.nowISO() });
                });
              });
            });
            t.oncomplete = res; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
          });
        }).then(function () { toast('تم حفظ القضية بنجاح'); location.hash = '#/cases/' + caseId; })
          .catch(function (e2) { errHandler(e2); });
      });
    }
    Promise.all([R.clients.all(), R.opponents.all()]).then(function (a) {
      var clients = a[0].filter(function (c) { return !c.archived; });
      var opponents = a[1].filter(function (o) { return !o.archived; });
      function go() {
        if (isEdit) {
          Promise.all([R.cases.get(id),
            R.caseClients.byIndex('caseId', id),
            R.caseOpponents.byIndex('caseId', id)]).then(function (x) {
            if (!x[0]) { view.innerHTML = emptyState('القضية غير موجودة'); return; }
            data = x[0];
            x[1].forEach(function (r) { selClients[r.clientId] = { role: r.role }; });
            x[2].forEach(function (r) { selOpps[r.opponentId] = { role: r.role }; });
            draw(clients, opponents);
          }).catch(errHandler);
        } else {
          if (params && params.clientId) selClients[params.clientId] = {};
          draw(clients, opponents);
        }
      }
      go();
    }).catch(errHandler);
  }

  function caseRecord(view, params, id, tab) {
    tab = tab || 'info';
    Promise.all([R.cases.get(id), caseClients(id), caseOpponents(id)]).then(function (a) {
      var cs = a[0], cls = a[1], ops = a[2];
      if (!cs) { view.innerHTML = emptyState('القضية غير موجودة'); return; }
      var tabs = [['info', 'بيانات القضية'], ['clients', 'العملاء (' + cls.length + ')'], ['opponents', 'الخصوم (' + ops.length + ')'],
        ['hearings', 'الجلسات'], ['procedures', 'الإجراءات'], ['judgments', 'الأحكام'], ['events', 'أحداث'], ['timeline', 'السجل الزمني'], ['notes', 'الملاحظات']];
      var html = '<div class="page-head"><h1>' + U.esc(caseTitle(cs)) + '</h1><div>' +
        '<a class="btn" href="#/cases/' + cs.id + '/edit">تعديل</a> ' +
        (cs.archived
          ? '<button class="btn" id="cs-restore">استعادة</button>'
          : '<button class="btn btn-danger" id="cs-arch">أرشفة</button>') + '</div></div>' +
        '<div class="breadcrumbs"><a href="#/cases">القضايا</a> / ' + U.esc(caseTitle(cs)) + '</div>' +
        '<div class="tabs">' + tabs.map(function (t2) {
          return '<a class="tab' + (t2[0] === tab ? ' active' : '') + '" href="#/cases/' + cs.id + '/' + t2[0] + '">' + t2[1] + '</a>';
        }).join('') + '</div><div id="tab-body"></div>';
      view.innerHTML = html;
      var body = document.getElementById('tab-body');
      var archBtn = document.getElementById('cs-arch'), restBtn = document.getElementById('cs-restore');
      if (archBtn) archBtn.addEventListener('click', function () {
        modal({ message: 'أرشفة القضية؟ ستختفي من القوائم النشطة ويبقى أرشيفها.', okText: 'أرشفة' }).then(function (ok) {
          if (!ok) return; cs.archived = true; R.cases.put(cs).then(function () { toast('تمت الأرشفة'); caseRecord(view, params, id, tab); }).catch(errHandler);
        });
      });
      if (restBtn) restBtn.addEventListener('click', function () {
        cs.archived = false; R.cases.put(cs).then(function () { toast('تمت الاستعادة'); caseRecord(view, params, id, tab); }).catch(errHandler);
      });

      if (tab === 'info') {
        body.innerHTML = '<section class="panel"><div class="detail-grid">' +
          dItem('رقم القضية', cs.caseNumber) + dItem('السنة', cs.caseYear) +
          dItem('نوع القضية', lkName('caseType', cs.caseTypeId)) +
          dItem('درجة التقاضي', lkName('litigationDegree', cs.litigationDegreeId)) +
          dItem('المحكمة', cs.court) + dItem('الدائرة', cs.circuit) +
          dItem('الحالة', lkName('caseStatus', cs.caseStatusId)) + dItem('تاريخ القيد', U.fmtDate(cs.filingDate)) +
          dItem('الموضوع', cs.subject) + dItem('ملاحظات', cs.notes) + '</div></section>';
      } else if (tab === 'clients') {
        body.innerHTML = '<section class="panel">' +
          (cls.length ? '<ul class="item-list">' + cls.map(function (x) {
            return '<li><a href="#/clients/' + x.client.id + '">' + U.esc(x.client.fullName) + '</a> <span class="badge">' + U.esc(lkName('clientRole', x.rel.role) || 'موكل') + '</span> ' +
              '<button class="btn btn-sm btn-danger" data-delrel="' + x.rel.id + '">إزالة الرابط</button></li>';
          }).join('') + '</ul>' : emptyState('لا يوجد عملاء مرتبطون')) +
          '<a class="btn btn-sm" href="#/cases/' + cs.id + '/edit">إدارة العملاء</a></section>';
      } else if (tab === 'opponents') {
        body.innerHTML = '<section class="panel">' +
          (ops.length ? '<ul class="item-list">' + ops.map(function (x) {
            return '<li><a href="#/opponents/' + x.opponent.id + '">' + U.esc(x.opponent.fullName) + '</a> <span class="badge">' + U.esc(lkName('opponentRole', x.rel.role) || '') + '</span>' +
              (x.opponent.lawyerName ? ' <span class="muted">محاميه: ' + U.esc(x.opponent.lawyerName) + '</span>' : '') + ' ' +
              '<button class="btn btn-sm btn-danger" data-delopp="' + x.rel.id + '">إزالة الرابط</button></li>';
          }).join('') + '</ul>' : emptyState('لا يوجد خصوم')) +
          '<a class="btn btn-sm" href="#/cases/' + cs.id + '/edit">إدارة الخصوم</a></section>';
      } else if (tab === 'hearings') {
        R.hearings.byIndex('caseId', id).then(function (rows) {
          rows.sort(function (x, y) { return (x.date || '').localeCompare(y.date || '') || (x.time || '').localeCompare(y.time || ''); });
          body.innerHTML = '<section class="panel"><a class="btn btn-sm btn-primary" href="#/hearings/new?caseId=' + id + '">+ جلسة جديدة</a><br><br>' +
            (rows.length ? '<ul class="item-list">' + rows.map(function (h) {
              return '<li><strong>' + U.fmtDate(h.date) + ' ' + U.esc(h.time || '') + '</strong> — ' + U.esc(h.court || '') +
                ' <span class="badge">' + U.esc(lkName('hearingStatus', h.statusId) || '') + '</span>' +
                (h.decision ? '<br><span class="muted">قرار الجلسة: ' + U.esc(h.decision) + '</span>' : '') +
                ' <a class="btn btn-sm" href="#/hearings/' + h.id + '/edit">تعديل</a></li>';
            }).join('') + '</ul>' : emptyState('لا توجد جلسات')) + '</section>';
        }).catch(errHandler);
      } else if (tab === 'procedures') {
        R.procedures.byIndex('caseId', id).then(function (rows) {
          rows.sort(function (x, y) { return (x.deadline || x.date || '').localeCompare(y.deadline || y.date || ''); });
          body.innerHTML = '<section class="panel"><a class="btn btn-sm btn-primary" href="#/procedures/new?caseId=' + id + '">+ إجراء جديد</a><br><br>' +
            (rows.length ? '<ul class="item-list">' + rows.map(function (p) {
              return '<li><strong>' + U.esc(p.description || lkName('procedureType', p.typeId)) + '</strong> ' +
                '<span class="badge">' + U.esc(lkName('procedureStatus', p.statusId) || '') + '</span>' +
                (p.deadline ? ' <span class="muted">الموعد النهائي: ' + U.fmtDate(p.deadline) + '</span>' : '') +
                ' <a class="btn btn-sm" href="#/procedures/' + p.id + '/edit">تعديل</a></li>';
            }).join('') + '</ul>' : emptyState('لا توجد إجراءات')) + '</section>';
        }).catch(errHandler);
      } else if (tab === 'judgments') {
        R.judgments.byIndex('caseId', id).then(function (rows) {
          rows.sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); });
          body.innerHTML = '<section class="panel"><a class="btn btn-sm btn-primary" href="#/judgments/new?caseId=' + id + '">+ حكم جديد</a><br><br>' +
            (rows.length ? '<ul class="item-list">' + rows.map(function (j) {
              return '<li><strong>' + U.fmtDate(j.date) + '</strong> — ' + U.esc(lkName('judgmentType', j.judgmentTypeId)) +
                ' <span class="badge">' + U.esc(lkName('judgmentStatus', j.statusId) || '') + '</span>' +
                (j.operativePart ? '<br><span class="muted">منطوق الحكم: ' + U.esc(j.operativePart) + '</span>' : '') +
                ' <a class="btn btn-sm" href="#/judgments/' + j.id + '/edit">تعديل</a></li>';
            }).join('') + '</ul>' : emptyState('لا توجد أحكام')) + '</section>';
        }).catch(errHandler);
      } else if (tab === 'events') {
        R.caseEvents.byIndex('caseId', id).then(function (rows) {
          rows.sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); });
          body.innerHTML = '<section class="panel"><a class="btn btn-sm btn-primary" href="#/events/new?caseId=' + id + '">+ حدث جديد</a><br><br>' +
            (rows.length ? '<ul class="item-list">' + rows.map(function (ev) {
              return '<li><strong>' + U.fmtDate(ev.date) + '</strong> — ' + U.esc(ev.title) +
                ' <span class="badge">' + U.esc(lkName('eventType', ev.typeId) || '') + '</span>' +
                (ev.description ? '<br><span class="muted">' + U.esc(ev.description) + '</span>' : '') +
                ' <button class="btn btn-sm btn-danger" data-delev="' + ev.id + '">حذف</button></li>';
            }).join('') + '</ul>' : emptyState('لا توجد أحداث')) + '</section>';
          U.$$('[data-delev]').forEach(function (b) { b.addEventListener('click', function () {
            modal({ message: 'حذف هذا الحدث نهائياً؟', okText: 'حذف', danger: true }).then(function (ok) {
              if (!ok) return; R.caseEvents.del(b.getAttribute('data-delev')).then(function () { toast('تم الحذف'); caseRecord(view, params, id, tab); }).catch(errHandler);
            });
          }); });
        }).catch(errHandler);
      } else if (tab === 'timeline') {
        buildTimeline(id, body);
      } else if (tab === 'notes') {
        body.innerHTML = '<section class="panel"><form id="f-notes">' +
          '<textarea id="cs-notes" rows="6">' + U.esc(cs.notes || '') + '</textarea>' +
          '<br><br><button class="btn btn-primary">حفظ الملاحظات</button></form></section>';
        document.getElementById('f-notes').addEventListener('submit', function (e) {
          e.preventDefault(); cs.notes = U.val('cs-notes');
          R.cases.put(cs).then(function () { toast('تم الحفظ'); }).catch(errHandler);
        });
      }

      U.$$('[data-delrel]').forEach(function (b) { b.addEventListener('click', function () {
        modal({ message: 'إزالة رابط العميل بهذه القضية؟ لن يتم حذف العميل.', okText: 'إزالة', danger: true }).then(function (ok) {
          if (!ok) return; R.caseClients.del(b.getAttribute('data-delrel')).then(function () { toast('تمت الإزالة'); caseRecord(view, params, id, tab); }).catch(errHandler);
        });
      }); });
      U.$$('[data-delopp]').forEach(function (b) { b.addEventListener('click', function () {
        modal({ message: 'إزالة رابط الخصم بهذه القضية؟ لن يتم حذف الخصم.', okText: 'إزالة', danger: true }).then(function (ok) {
          if (!ok) return; R.caseOpponents.del(b.getAttribute('data-delopp')).then(function () { toast('تمت الإزالة'); caseRecord(view, params, id, tab); }).catch(errHandler);
        });
      }); });
    }).catch(errHandler);
  }

  function buildTimeline(caseId, body) {
    Promise.all([
      R.hearings.byIndex('caseId', caseId),
      R.procedures.byIndex('caseId', caseId),
      R.judgments.byIndex('caseId', caseId),
      R.caseEvents.byIndex('caseId', caseId),
      R.cases.get(caseId)
    ]).then(function (a) {
      var items = [];
      a[0].forEach(function (h) { items.push({ date: h.date, icon: '📅', title: 'جلسة', desc: (h.time ? h.time + ' — ' : '') + (h.court || '') + (h.decision ? ' | قرار: ' + h.decision : ''), id: h.id }); });
      a[1].forEach(function (p) { items.push({ date: p.date, icon: '📋', title: 'إجراء', desc: p.description || lkName('procedureType', p.typeId), id: p.id }); });
      a[2].forEach(function (j) { items.push({ date: j.date, icon: '⚖️', title: lkName('judgmentType', j.judgmentTypeId) || 'حكم', desc: j.operativePart || j.summary || '', id: j.id }); });
      a[3].forEach(function (ev) { items.push({ date: ev.date, icon: '📌', title: ev.title, desc: lkName('eventType', ev.typeId) || '', id: ev.id }); });
      if (a[4] && a[4].filingDate) items.push({ date: a[4].filingDate, icon: '⚖️', title: 'قيد الدعوى', desc: a[4].subject || '', id: 'filing' });
      items.sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); });
      body.innerHTML = '<section class="panel">' + (items.length
        ? '<div class="timeline">' + items.map(function (it) {
            return '<div class="tl-item"><div class="tl-date">' + U.fmtDate(it.date) + '</div><div class="tl-body"><strong>' + it.icon + ' ' + U.esc(it.title) + '</strong><p>' + U.esc(it.desc) + '</p></div></div>';
          }).join('') + '</div>'
        : emptyState('لا توجد أحداث بعد')) + '</section>';
    }).catch(errHandler);
  }
