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
