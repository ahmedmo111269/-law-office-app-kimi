/* =========================================================
   Law Office Management System
   Main Application
   ========================================================= */

(function (L) {
  'use strict';

  var DB = L.DB;
  var view = document.getElementById('view');

  /* =========================================================
     BASIC UI
     ========================================================= */

  function toast(message, type) {
    type = type || 'success';

    var old = document.querySelector('.toast');
    if (old) old.remove();

    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(function () {
      el.classList.add('show');
    }, 20);

    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () {
        if (el.parentNode) el.remove();
      }, 300);
    }, 2500);
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function fmtDate(v) {
    if (!v) return '-';

    var s = String(v).slice(0, 10);
    var p = s.split('-');

    if (p.length !== 3) return esc(v);

    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return 'id-' + Date.now() + '-' +
      Math.random().toString(36).slice(2);
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call(
      (root || document).querySelectorAll(selector)
    );
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setVal(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value == null ? '' : value;
  }

  function emptyState(message, button) {
    return (
      '<div class="empty-state">' +
        '<div>' + esc(message || 'لا توجد بيانات') + '</div>' +
        (button || '') +
      '</div>'
    );
  }

  function field(label, input) {
    return (
      '<div class="form-group">' +
        '<label>' + esc(label) + '</label>' +
        input +
      '</div>'
    );
  }

  function inp(id, value, placeholder, type) {
    return (
      '<input id="' + esc(id) + '"' +
      ' type="' + esc(type || 'text') + '"' +
      ' value="' + esc(value || '') + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
      '>'
    );
  }

  function area(id, value, placeholder) {
    return (
      '<textarea id="' + esc(id) + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
      '>' + esc(value || '') + '</textarea>'
    );
  }

  function selectHtml(id, items, selected, emptyText) {
    var html =
      '<select id="' + esc(id) + '">' +
      (emptyText !== undefined
        ? '<option value="">' + esc(emptyText) + '</option>'
        : '');

    (items || []).forEach(function (item) {
      html +=
        '<option value="' + esc(item.id) + '"' +
        (String(item.id) === String(selected || '') ? ' selected' : '') +
        '>' + esc(item.name) + '</option>';
    });

    html += '</select>';
    return html;
  }

  function pageHead(title, buttons) {
    return (
      '<div class="page-head">' +
        '<h1>' + esc(title) + '</h1>' +
        '<div>' + (buttons || '') + '</div>' +
      '</div>'
    );
  }

  function panel(title, body) {
    return (
      '<section class="panel">' +
        (title ? '<h2>' + esc(title) + '</h2>' : '') +
        body +
      '</section>'
    );
  }

  /* =========================================================
     LOOKUPS
     ========================================================= */

  var LK = {};

  async function loadLookups() {
    LK = {};

    var rows = await DB.repo('lookups').all();

    rows.forEach(function (row) {
      if (!LK[row.category]) LK[row.category] = [];
      LK[row.category].push(row);
    });

    Object.keys(LK).forEach(function (key) {
      LK[key].sort(function (a, b) {
        return String(a.name || '').localeCompare(
          String(b.name || ''),
          'ar'
        );
      });
    });

    return LK;
  }

  function lookup(category, id) {
    var list = LK[category] || [];

    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        return list[i];
      }
    }

    return null;
  }

  function lookupName(category, id) {
    var x = lookup(category, id);
    return x ? x.name : '-';
  }

  function lookupId(category, name) {
    var list = LK[category] || [];

    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) return list[i].id;
    }

    return null;
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function currentRoute() {
    var hash = location.hash || '#/dashboard';
    var parts = hash.replace(/^#\/?/, '').split('/');

    return {
      name: parts[0] || 'dashboard',
      id: parts[1] || null,
      extra: parts.slice(2)
    };
  }

  function go(route) {
    location.hash = '#/' + route;
  }

  function activateNav(name) {
    $$('.nav-link').forEach(function (a) {
      a.classList.toggle(
        'active',
        a.getAttribute('data-nav') === name
      );
    });
  }

  /* =========================================================
     DASHBOARD
     ========================================================= */

  async function dashboard() {
    activateNav('dashboard');

    view.innerHTML =
      '<div class="loading">جارٍ تحميل لوحة التحكم...</div>';

    var clients = await DB.repo('clients').all();
    var cases = await DB.repo('cases').all();
    var opponents = await DB.repo('opponents').all();
    var hearings = await DB.repo('hearings').all();
    var procedures = await DB.repo('procedures').all();
    var judgments = await DB.repo('judgments').all();

    var activeClients = clients.filter(function (x) {
      return !x.archived;
    });

    var activeCases = cases.filter(function (x) {
      return !x.archived;
    });

    var t = today();

    var todayHearings = hearings.filter(function (h) {
      return h.date === t;
    });

    var doneId = lookupId('procedureStatus', 'تم');
    var cancelledId = lookupId('procedureStatus', 'ملغي');

    var overdue = procedures.filter(function (p) {
      return p.deadline &&
        p.deadline < t &&
        String(p.statusId) !== String(doneId) &&
        String(p.statusId) !== String(cancelledId);
    });

    view.innerHTML =
      pageHead('لوحة التحكم',
        '<button class="btn btn-primary" data-action="new-client">+ عميل جديد</button>') +

      '<div class="stats-grid">' +
        '<a class="stat-card" href="#/clients">' +
          '<span class="stat-num">' + activeClients.length + '</span>' +
          '<span class="stat-label">العملاء</span>' +
        '</a>' +

        '<a class="stat-card" href="#/cases">' +
          '<span class="stat-num">' + activeCases.length + '</span>' +
          '<span class="stat-label">القضايا</span>' +
        '</a>' +

        '<a class="stat-card" href="#/opponents">' +
          '<span class="stat-num">' + opponents.length + '</span>' +
          '<span class="stat-label">الخصوم</span>' +
        '</a>' +

        '<a class="stat-card" href="#/hearings">' +
          '<span class="stat-num">' + todayHearings.length + '</span>' +
          '<span class="stat-label">جلسات اليوم</span>' +
        '</a>' +

        '<a class="stat-card" href="#/procedures">' +
          '<span class="stat-num">' + overdue.length + '</span>' +
          '<span class="stat-label">إجراءات متأخرة</span>' +
        '</a>' +

        '<a class="stat-card" href="#/judgments">' +
          '<span class="stat-num">' + judgments.length + '</span>' +
          '<span class="stat-label">الأحكام</span>' +
        '</a>' +
      '</div>' +

      '<div class="quick-actions">' +
        '<a class="btn" href="#/clients/new">👥 إضافة عميل</a>' +
        '<a class="btn" href="#/cases/new">⚖️ إضافة قضية</a>' +
        '<a class="btn" href="#/hearings/new">📅 إضافة جلسة</a>' +
        '<a class="btn" href="#/procedures/new">📋 إضافة إجراء</a>' +
        '<a class="btn" href="#/backup">💾 النسخ الاحتياطي</a>' +
      '</div>' +

      panel(
        'جلسات اليوم',
        todayHearings.length
          ? '<ul class="item-list">' +
              todayHearings.map(function (h) {
                return (
                  '<li>' +
                    '<strong>' + esc(h.time || '') + '</strong> — ' +
                    esc(h.court || '') +
                    (h.circuit
                      ? ' — دائرة ' + esc(h.circuit)
                      : '') +
                  '</li>'
                );
              }).join('') +
            '</ul>'
          : '<div class="muted">لا توجد جلسات مسجلة اليوم.</div>'
      ) +

      panel(
        'الإجراءات المتأخرة',
        overdue.length
          ? '<ul class="item-list">' +
              overdue.slice(0, 10).map(function (p) {
                return (
                  '<li>' +
                    '<span class="badge badge-danger">متأخر</span> ' +
                    esc(p.title || p.description || 'إجراء') +
                    ' — ' + fmtDate(p.deadline) +
                  '</li>'
                );
              }).join('') +
            '</ul>'
          : '<div class="muted">لا توجد إجراءات متأخرة.</div>'
      );
  }

  /* =========================================================
     CLIENTS
     ========================================================= */

  async function clientsList() {
    activateNav('clients');

    var clients = await DB.repo('clients').all();

    var q = new URLSearchParams(location.hash.split('?')[1] || '');
    var search = (q.get('q') || '').trim().toLowerCase();

    clients = clients.filter(function (c) {
      if (c.archived) return false;
      if (!search) return true;

      return [
        c.fullName,
        c.nationalId,
        c.phone1,
        c.phone2,
        c.whatsapp
      ].some(function (v) {
        return String(v || '').toLowerCase().indexOf(search) !== -1;
      });
    });

    view.innerHTML =
      pageHead(
        'العملاء',
        '<a class="btn btn-primary" href="#/clients/new">+ عميل جديد</a>'
      ) +

      '<div class="filters">' +
        '<input id="client-search" value="' + esc(search) +
        '" placeholder="ابحث بالاسم أو الرقم القومي أو الهاتف...">' +
      '</div>' +

      (
        clients.length
          ? '<div class="cards-grid">' +
              clients.map(function (c) {
                return (
                  '<div class="card">' +
                    '<h3>' + esc(c.fullName) + '</h3>' +

                    '<p><strong>الرقم القومي:</strong> ' +
                    esc(c.nationalId || '-') + '</p>' +

                    '<p><strong>الهاتف:</strong> ' +
                    esc(c.phone1 || '-') + '</p>' +

                    (c.address
                      ? '<p><strong>العنوان:</strong> ' +
                        esc(c.address) + '</p>'
                      : '') +

                    '<div class="card-actions">' +
                      '<a class="btn btn-sm btn-primary" href="#/clients/' +
                      esc(c.id) + '">فتح السجل</a>' +

                      '<a class="btn btn-sm" href="#/clients/' +
                      esc(c.id) + '/edit">تعديل</a>' +

                      '<button class="btn btn-sm btn-danger" ' +
                      'data-archive-client="' + esc(c.id) + '">' +
                      'أرشفة</button>' +
                    '</div>' +
                  '</div>'
                );
              }).join('') +
            '</div>'
          : emptyState(
              'لا توجد عملاء مطابقة.',
              '<a class="btn btn-primary" href="#/clients/new">إضافة عميل</a>'
            )
      );
  }

  async function clientForm(id) {
    activateNav('clients');

    var existing = id
      ? await DB.repo('clients').get(id)
      : null;

    if (id && !existing) {
      toast('العميل غير موجود', 'error');
      go('clients');
      return;
    }

    var title = existing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد';

    view.innerHTML =
      pageHead(
        title,
        '<a class="btn" href="#/clients">العودة</a>'
      ) +

      '<div class="form-panel">' +

        '<div class="form-row">' +
          field('الاسم بالكامل',
            inp('fullName', existing && existing.fullName, 'اسم العميل')) +

          field('الرقم القومي',
            inp('nationalId', existing && existing.nationalId,
              '14 رقمًا')) +
        '</div>' +

        '<div class="form-row">' +
          field('الهاتف الأول',
            inp('phone1', existing && existing.phone1, 'رقم الهاتف')) +

          field('الهاتف الثاني',
            inp('phone2', existing && existing.phone2, 'رقم اختياري')) +
        '</div>' +

        '<div class="form-row">' +
          field('واتساب',
            inp('whatsapp', existing && existing.whatsapp,
              'رقم واتساب')) +

          field('البريد الإلكتروني',
            inp('email', existing && existing.email,
              'البريد الإلكتروني', 'email')) +
        '</div>' +

        field('العنوان',
          inp('address', existing && existing.address, 'العنوان')) +

        field('المهنة',
          inp('profession', existing && existing.profession, 'المهنة')) +

        field('ملاحظات',
          area('notes', existing && existing.notes, 'ملاحظات عن العميل')) +

        '<div class="form-actions">' +
          '<button class="btn btn-primary" data-save-client="' +
          esc(id || '') + '">' +
          (existing ? 'حفظ التعديلات' : 'حفظ العميل') +
          '</button>' +

          '<a class="btn" href="#/clients">إلغاء</a>' +
        '</div>' +

      '</div>';
  }

  async function clientRecord(id) {
    activateNav('clients');

    var client = await DB.repo('clients').get(id);

    if (!client) {
      toast('العميل غير موجود', 'error');
      go('clients');
      return;
    }

    var relations = await DB.repo('caseClients').byIndex('clientId', id);
    var cases = await DB.repo('cases').all();

    var clientCases = relations.map(function (rel) {
      return cases.find(function (c) {
        return String(c.id) === String(rel.caseId);
      });
    }).filter(Boolean);

    view.innerHTML =
      pageHead(
        'سجل العميل',
        '<div class="quick-actions">' +
          '<a class="btn" href="#/clients">← العملاء</a>' +
          '<a class="btn btn-primary" href="#/clients/' +
          esc(id) + '/edit">تعديل البيانات</a>' +
        '</div>'
      ) +

      panel(
        'بيانات العميل',
        '<div class="detail-grid">' +
          detail('الاسم', client.fullName) +
          detail('الرقم القومي', client.nationalId) +
          detail('الهاتف', client.phone1) +
          detail('هاتف إضافي', client.phone2) +
          detail('واتساب', client.whatsapp) +
          detail('البريد', client.email) +
          detail('المهنة', client.profession) +
          detail('العنوان', client.address) +
        '</div>' +

        (client.notes
          ? '<hr style="margin:15px 0;border:0;border-top:1px solid #eee">' +
            '<strong>ملاحظات:</strong><p>' +
            esc(client.notes) + '</p>'
          : '')
      ) +

      panel(
        'قضايا العميل',
        clientCases.length
          ? '<div class="table-wrap"><table>' +
              '<thead><tr>' +
                '<th>رقم القضية</th>' +
                '<th>السنة</th>' +
                '<th>المحكمة</th>' +
                '<th>الصفة</th>' +
                '<th></th>' +
              '</tr></thead>' +
              '<tbody>' +

              clientCases.map(function (c) {
                var rel = relations.find(function (r) {
                  return String(r.caseId) === String(c.id);
                });

                return (
                  '<tr>' +
                    '<td>' + esc(c.caseNumber || '-') + '</td>' +
                    '<td>' + esc(c.caseYear || '-') + '</td>' +
                    '<td>' + esc(c.court || '-') + '</td>' +
                    '<td>' +
                      esc(lookupName('clientRole', rel && rel.roleId)) +
                    '</td>' +
                    '<td>' +
                      '<a class="btn btn-sm" href="#/cases/' +
                      esc(c.id) + '">فتح القضية</a>' +
                    '</td>' +
                  '</tr>'
                );
              }).join('') +

              '</tbody></table></div>'
          : '<div class="muted">لا توجد قضايا مرتبطة بهذا العميل.</div>'
      );
  }

  function detail(key, value) {
    return (
      '<div class="detail-item">' +
        '<span class="detail-key">' + esc(key) + '</span>' +
        '<span class="detail-val">' + esc(value || '-') + '</span>' +
      '</div>'
    );
  }

  /* =========================================================
     CASES
     ========================================================= */

  async function casesList() {
    activateNav('cases');

    var cases = await DB.repo('cases').all();
    cases = cases.filter(function (c) {
      return !c.archived;
    });

    view.innerHTML =
      pageHead(
        'القضايا',
        '<a class="btn btn-primary" href="#/cases/new">+ قضية جديدة</a>'
      ) +

      '<div class="filters">' +
        '<input id="case-search" placeholder="بحث برقم القضية أو المحكمة أو الدائرة...">' +
        '<select id="case-status-filter">' +
          '<option value="">كل الحالات</option>' +
          (LK.caseStatus || []).map(function (x) {
            return '<option value="' + esc(x.id) + '">' +
              esc(x.name) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +

      '<div id="cases-container">' +
        renderCasesTable(cases) +
      '</div>';
  }

  function renderCasesTable(cases) {
    if (!cases.length) {
      return emptyState(
        'لا توجد قضايا.',
        '<a class="btn btn-primary" href="#/cases/new">إضافة قضية</a>'
      );
    }

    return (
      '<div class="table-wrap">' +
        '<table>' +
          '<thead><tr>' +
            '<th>رقم القضية</th>' +
            '<th>السنة</th>' +
            '<th>نوع القضية</th>' +
            '<th>المحكمة</th>' +
            '<th>الحالة</th>' +
            '<th>إجراء</th>' +
          '</tr></thead>' +

          '<tbody>' +

          cases.map(function (c) {
            return (
              '<tr>' +
                '<td>' + esc(c.caseNumber || '-') + '</td>' +
                '<td>' + esc(c.caseYear || '-') + '</td>' +
                '<td>' +
                  esc(lookupName('caseType', c.caseTypeId)) +
                '</td>' +
                '<td>' + esc(c.court || '-') + '</td>' +
                '<td>' +
                  '<span class="badge">' +
                    esc(lookupName('caseStatus', c.caseStatusId)) +
                  '</span>' +
                '</td>' +
                '<td>' +
                  '<a class="btn btn-sm btn-primary" href="#/cases/' +
                  esc(c.id) + '">فتح</a> ' +
                  '<a class="btn btn-sm" href="#/cases/' +
                  esc(c.id) + '/edit">تعديل</a>' +
                '</td>' +
              '</tr>'
            );
          }).join('') +

          '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  async function caseForm(id) {
    activateNav('cases');

    var existing = id
      ? await DB.repo('cases').get(id)
      : null;

    if (id && !existing) {
      toast('القضية غير موجودة', 'error');
      go('cases');
      return;
    }

    var title = existing ? 'تعديل القضية' : 'إضافة قضية جديدة';

    view.innerHTML =
      pageHead(
        title,
        '<a class="btn" href="#/cases">العودة</a>'
      ) +

      '<div class="form-panel">' +

        '<div class="form-row">' +
          field('رقم القضية',
            inp('caseNumber',
              existing && existing.caseNumber,
              'مثال: 1234')) +

          field('سنة القضية',
            inp('caseYear',
              existing && existing.caseYear,
              'مثال: 2026',
              'number')) +
        '</div>' +

        '<div class="form-row">' +
          field('نوع القضية',
            selectHtml(
              'caseTypeId',
              LK.caseType || [],
              existing && existing.caseTypeId,
              'اختر نوع القضية'
            )) +

          field('درجة التقاضي',
            selectHtml(
              'litigationDegreeId',
              LK.litigationDegree || [],
              existing && existing.litigationDegreeId,
              'اختر الدرجة'
            )) +
        '</div>' +

        '<div class="form-row">' +
          field('المحكمة',
            inp('court', existing && existing.court,
              'اسم المحكمة')) +

          field('الدائرة',
            inp('circuit', existing && existing.circuit,
              'الدائرة')) +
        '</div>' +

        '<div class="form-row">' +
          field('حالة القضية',
            selectHtml(
              'caseStatusId',
              LK.caseStatus || [],
              existing && existing.caseStatusId,
              'اختر الحالة'
            )) +

          field('تاريخ القيد',
            inp('filingDate',
              existing && existing.filingDate,
              '',
              'date')) +
        '</div>' +

        field('موضوع القضية',
          area('subject',
            existing && existing.subject,
            'موضوع القضية')) +

        field('ملاحظات',
          area('notes',
            existing && existing.notes,
            'ملاحظات')) +

        '<div class="form-actions">' +
          '<button class="btn btn-primary" data-save-case="' +
          esc(id || '') + '">' +
          (existing ? 'حفظ التعديلات' : 'حفظ القضية') +
          '</button>' +

          '<a class="btn" href="#/cases">إلغاء</a>' +
        '</div>' +

      '</div>';
  }

  async function caseRecord(id) {
    activateNav('cases');

    var c = await DB.repo('cases').get(id);

    if (!c) {
      toast('القضية غير موجودة', 'error');
      go('cases');
      return;
    }

    var cc = await DB.repo('caseClients').byIndex('caseId', id);
    var co = await DB.repo('caseOpponents').byIndex('caseId', id);

    var clients = await DB.repo('clients').all();
    var opponents = await DB.repo('opponents').all();

    var hearings = await DB.repo('hearings').byIndex('caseId', id);
    var procedures = await DB.repo('procedures').byIndex('caseId', id);
    var judgments = await DB.repo('judgments').byIndex('caseId', id);
    var events = await DB.repo('caseEvents').byIndex('caseId', id);

    view.innerHTML =
      pageHead(
        'ملف القضية',
        '<div class="quick-actions">' +
          '<a class="btn" href="#/cases">← القضايا</a>' +
          '<a class="btn" href="#/cases/' + esc(id) + '/edit">تعديل</a>' +
        '</div>'
      ) +

      panel(
        caseTitle(c),
        '<div class="detail-grid">' +
          detail('رقم القضية', c.caseNumber) +
          detail('السنة', c.caseYear) +
          detail('نوع القضية', lookupName('caseType', c.caseTypeId)) +
          detail('درجة التقاضي',
            lookupName('litigationDegree', c.litigationDegreeId)) +
          detail('المحكمة', c.court) +
          detail('الدائرة', c.circuit) +
          detail('الحالة',
            lookupName('caseStatus', c.caseStatusId)) +
          detail('تاريخ القيد', fmtDate(c.filingDate)) +
        '</div>' +

        (c.subject
          ? '<div style="margin-top:15px"><strong>الموضوع:</strong><br>' +
            esc(c.subject) + '</div>'
          : '') +

        (c.notes
          ? '<div style="margin-top:15px"><strong>ملاحظات:</strong><br>' +
            esc(c.notes) + '</div>'
          : '')
      ) +

      panel(
        'العملاء المرتبطون',
        cc.length
          ? '<ul class="item-list">' +
            cc.map(function (r) {
              var client = clients.find(function (x) {
                return String(x.id) === String(r.clientId);
              });

              if (!client) return '';

              return (
                '<li>' +
                  '<a href="#/clients/' + esc(client.id) + '">' +
                    esc(client.fullName) +
                  '</a>' +
                  ' — ' +
                  esc(lookupName('clientRole', r.roleId)) +
                '</li>'
              );
            }).join('') +
            '</ul>'
          : '<div class="muted">لا يوجد عملاء مرتبطون.</div>'
      ) +

      panel(
        'الخصوم المرتبطون',
        co.length
          ? '<ul class="item-list">' +
            co.map(function (r) {
              var opponent = opponents.find(function (x) {
                return String(x.id) === String(r.opponentId);
              });

              if (!opponent) return '';

              return (
                '<li>' +
                  '<a href="#/opponents/' +
                  esc(opponent.id) + '">' +
                    esc(opponent.fullName) +
                  '</a>' +
                  ' — ' +
                  esc(lookupName('opponentRole', r.roleId)) +
                '</li>'
              );
            }).join('') +
            '</ul>'
          : '<div class="muted">لا يوجد خصوم مرتبطون.</div>'
      ) +

      panel(
        'إحصائيات القضية',
        '<div class="stats-grid">' +
          '<div class="stat-card">' +
            '<span class="stat-num">' + hearings.length + '</span>' +
            '<span class="stat-label">الجلسات</span>' +
          '</div>' +

          '<div class="stat-card">' +
            '<span class="stat-num">' + procedures.length + '</span>' +
            '<span class="stat-label">الإجراءات</span>' +
          '</div>' +

          '<div class="stat-card">' +
            '<span class="stat-num">' + judgments.length + '</span>' +
            '<span class="stat-label">الأحكام</span>' +
          '</div>' +

          '<div class="stat-card">' +
            '<span class="stat-num">' + events.length + '</span>' +
            '<span class="stat-label">الأحداث</span>' +
          '</div>' +
        '</div>'
      );
  }

  function caseTitle(c) {
    if (!c) return 'القضية';

    return (
      'القضية رقم ' +
      (c.caseNumber || '-') +
      ' لسنة ' +
      (c.caseYear || '-')
    );
  }

  /* =========================================================
     OPPONENTS
     ========================================================= */

  async function opponentsList() {
    activateNav('opponents');

    var rows = await DB.repo('opponents').all();

    rows = rows.filter(function (x) {
      return !x.archived;
    });

    view.innerHTML =
      pageHead(
        'الخصوم',
        '<a class="btn btn-primary" href="#/opponents/new">+ خصم جديد</a>'
      ) +

      '<div class="filters">' +
        '<input id="opponent-search" placeholder="ابحث عن الخصم...">' +
      '</div>' +

      '<div id="opponents-container">' +
        renderOpponents(rows) +
      '</div>';
  }

  function renderOpponents(rows) {
    if (!rows.length) {
      return emptyState(
        'لا توجد خصوم.',
        '<a class="btn btn-primary" href="#/opponents/new">إضافة خصم</a>'
      );
    }

    return (
      '<div class="cards-grid">' +
      rows.map(function (o) {
        return (
          '<div class="card">' +
            '<h3>' + esc(o.fullName) + '</h3>' +

            (o.phone
              ? '<p><strong>الهاتف:</strong> ' +
                esc(o.phone) + '</p>'
              : '') +

            (o.address
              ? '<p><strong>العنوان:</strong> ' +
                esc(o.address) + '</p>'
              : '') +

            '<div class="card-actions">' +
              '<a class="btn btn-sm btn-primary" href="#/opponents/' +
              esc(o.id) + '">فتح</a>' +

              '<a class="btn btn-sm" href="#/opponents/' +
              esc(o.id) + '/edit">تعديل</a>' +
            '</div>' +
          '</div>'
        );
      }).join('') +
      '</div>'
    );
  }

  async function opponentForm(id) {
    activateNav('opponents');

    var o = id ? await DB.repo('opponents').get(id) : null;

    view.innerHTML =
      pageHead(
        o ? 'تعديل الخصم' : 'إضافة خصم جديد',
        '<a class="btn" href="#/opponents">العودة</a>'
      ) +

      '<div class="form-panel">' +

        field('الاسم بالكامل',
          inp('fullName', o && o.fullName, 'اسم الخصم')) +

        field('الهاتف',
          inp('phone', o && o.phone, 'رقم الهاتف')) +

        field('العنوان',
          inp('address', o && o.address, 'العنوان')) +

        field('ملاحظات',
          area('notes', o && o.notes, 'ملاحظات')) +

        '<div class="form-actions">' +
          '<button class="btn btn-primary" data-save-opponent="' +
          esc(id || '') + '">' +
          (o ? 'حفظ التعديلات' : 'حفظ الخصم') +
          '</button>' +

          '<a class="btn" href="#/opponents">إلغاء</a>' +
        '</div>' +

      '</div>';
  }

  async function opponentRecord(id) {
    activateNav('opponents');

    var o = await DB.repo('opponents').get(id);

    if (!o) {
      toast('الخصم غير موجود', 'error');
      go('opponents');
      return;
    }

    var relations =
      await DB.repo('caseOpponents').byIndex('opponentId', id);

    var cases = await DB.repo('cases').all();

    var related = relations.map(function (r) {
      return {
        relation: r,
        case: cases.find(function (c) {
          return String(c.id) === String(r.caseId);
        })
      };
    }).filter(function (x) {
      return x.case;
    });

    view.innerHTML =
      pageHead(
        'سجل الخصم',
        '<div class="quick-actions">' +
          '<a class="btn" href="#/opponents">← الخصوم</a>' +
          '<a class="btn" href="#/opponents/' +
          esc(id) + '/edit">تعديل</a>' +
        '</div>'
      ) +

      panel(
        'بيانات الخصم',
        '<div class="detail-grid">' +
          detail('الاسم', o.fullName) +
          detail('الهاتف', o.phone) +
          detail('العنوان', o.address) +
        '</div>' +
        (o.notes
          ? '<p style="margin-top:15px">' +
            esc(o.notes) + '</p>'
          : '')
      ) +

      panel(
        'القضايا المرتبطة',
        related.length
          ? '<div class="table-wrap"><table>' +
              '<thead><tr>' +
                '<th>القضية</th>' +
                '<th>المحكمة</th>' +
                '<th>الصفة</th>' +
                '<th></th>' +
              '</tr></thead><tbody>' +

              related.map(function (x) {
                return (
                  '<tr>' +
                    '<td>' + esc(caseTitle(x.case)) + '</td>' +
                    '<td>' + esc(x.case.court || '-') + '</td>' +
                    '<td>' +
                      esc(lookupName(
                        'opponentRole',
                        x.relation.roleId
                      )) +
                    '</td>' +
                    '<td>' +
                      '<a class="btn btn-sm" href="#/cases/' +
                      esc(x.case.id) + '">فتح القضية</a>' +
                    '</td>' +
                  '</tr>'
                );
              }).join('') +

              '</tbody></table></div>'
          : '<div class="muted">لا توجد قضايا مرتبطة.</div>'
      );
  }

  /* =========================================================
     UNIVERSAL SEARCH
     ========================================================= */

  async function universalSearch() {
    activateNav('search');

    view.innerHTML =
      pageHead('البحث الشامل') +

      '<div class="panel">' +
        '<input id="global-search" autofocus ' +
        'placeholder="ابحث في العملاء والقضايا والخصوم...">' +
      '</div>' +

      '<div id="search-results"></div>';

    $('#global-search').addEventListener('input', function () {
      performSearch(this.value);
    });
  }

  async function performSearch(q) {
    q = String(q || '').trim().toLowerCase();

    var box = $('#search-results');

    if (!box) return;

    if (!q) {
      box.innerHTML =
        '<div class="muted">اكتب كلمة أو رقمًا للبحث.</div>';
      return;
    }

    var clients = await DB.repo('clients').all();
    var cases = await DB.repo('cases').all();
    var opponents = await DB.repo('opponents').all();

    var result = [];

    clients.forEach(function (c) {
      if (
        String(c.fullName || '').toLowerCase().includes(q) ||
        String(c.nationalId || '').toLowerCase().includes(q) ||
        String(c.phone1 || '').toLowerCase().includes(q)
      ) {
        result.push(
          '<li>' +
            '<span class="badge">عميل</span> ' +
            '<a href="#/clients/' + esc(c.id) + '">' +
              esc(c.fullName) +
            '</a>' +
          '</li>'
        );
      }
    });

    cases.forEach(function (c) {
      var text = [
        c.caseNumber,
        c.caseYear,
        c.court,
        c.circuit,
        c.subject
      ].join(' ').toLowerCase();

      if (text.includes(q)) {
        result.push(
          '<li>' +
            '<span class="badge">قضية</span> ' +
            '<a href="#/cases/' + esc(c.id) + '">' +
              esc(caseTitle(c)) +
            '</a>' +
            ' — ' + esc(c.court || '') +
          '</li>'
        );
      }
    });

    opponents.forEach(function (o) {
      if (
        String(o.fullName || '').toLowerCase().includes(q) ||
        String(o.phone || '').toLowerCase().includes(q)
      ) {
        result.push(
          '<li>' +
            '<span class="badge">خصم</span> ' +
            '<a href="#/opponents/' + esc(o.id) + '">' +
              esc(o.fullName) +
            '</a>' +
          '</li>'
        );
      }
    });

    box.innerHTML = result.length
      ? '<div class="panel"><ul class="item-list">' +
        result.join('') +
        '</ul></div>'
      : emptyState('لا توجد نتائج.');
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  document.addEventListener('click', async function (e) {

    var saveClient = e.target.closest('[data-save-client]');
    if (saveClient) {
      var id = saveClient.getAttribute('data-save-client');

      var data = {
        id: id || uid(),
        fullName: val('fullName').trim(),
        nationalId: val('nationalId').trim(),
        phone1: val('phone1').trim(),
        phone2: val('phone2').trim(),
        whatsapp: val('whatsapp').trim(),
        email: val('email').trim(),
        address: val('address').trim(),
        profession: val('profession').trim(),
        notes: val('notes').trim(),
        archived: false,
        updatedAt: new Date().toISOString()
      };

      if (!data.fullName) {
        toast('يجب إدخال اسم العميل', 'error');
        return;
      }

      if (!id) data.createdAt = data.updatedAt;

      try {
        await DB.repo('clients').put(data);
        toast('تم حفظ العميل');
        go('clients/' + data.id);
      } catch (err) {
        console.error(err);
        toast('حدث خطأ أثناء حفظ العميل', 'error');
      }

      return;
    }

    var saveCase = e.target.closest('[data-save-case]');
    if (saveCase) {
      var caseId = saveCase.getAttribute('data-save-case');

      var c = {
        id: caseId || uid(),
        caseNumber: val('caseNumber').trim(),
        caseYear: val('caseYear').trim(),
        caseTypeId: val('caseTypeId'),
        litigationDegreeId: val('litigationDegreeId'),
        court: val('court').trim(),
        circuit: val('circuit').trim(),
        caseStatusId: val('caseStatusId'),
        filingDate: val('filingDate'),
        subject: val('subject').trim(),
        notes: val('notes').trim(),
        archived: false,
        updatedAt: new Date().toISOString()
      };

      if (!c.caseNumber) {
        toast('أدخل رقم القضية', 'error');
        return;
      }

      if (!caseId) c.createdAt = c.updatedAt;

      try {
        await DB.repo('cases').put(c);
        toast('تم حفظ القضية');
        go('cases/' + c.id);
      } catch (err2) {
        console.error(err2);
        toast('حدث خطأ أثناء حفظ القضية', 'error');
      }

      return;
    }

    var saveOpponent =
      e.target.closest('[data-save-opponent]');

    if (saveOpponent) {
      var oid = saveOpponent.getAttribute('data-save-opponent');

      var o = {
        id: oid || uid(),
        fullName: val('fullName').trim(),
        phone: val('phone').trim(),
        address: val('address').trim(),
        notes: val('notes').trim(),
        archived: false,
        updatedAt: new Date().toISOString()
      };

      if (!o.fullName) {
        toast('يجب إدخال اسم الخصم', 'error');
        return;
      }

      if (!oid) o.createdAt = o.updatedAt;

      try {
        await DB.repo('opponents').put(o);
        toast('تم حفظ الخصم');
        go('opponents/' + o.id);
      } catch (err3) {
        console.error(err3);
        toast('حدث خطأ أثناء حفظ الخصم', 'error');
      }

      return;
    }

    var archiveClient =
      e.target.closest('[data-archive-client]');

    if (archiveClient) {
      var cid =
        archiveClient.getAttribute('data-archive-client');

      if (!confirm('هل تريد أرشفة هذا العميل؟')) return;

      var client = await DB.repo('clients').get(cid);

      if (client) {
        client.archived = true;
        client.updatedAt = new Date().toISOString();
        await DB.repo('clients').put(client);
        toast('تمت أرشفة العميل');
        clientsList();
      }

      return;
    }

    if (e.target.closest('[data-action="new-client"]')) {
      go('clients/new');
      return;
    }
  });

  /* =========================================================
     ROUTER
     ========================================================= */

  async function renderRoute() {
    var r = currentRoute();

    try {
      if (r.name === 'dashboard') {
        await dashboard();
        return;
      }

      if (r.name === 'clients') {
        if (!r.id) {
          await clientsList();
          return;
        }

        if (r.id === 'new') {
          await clientForm(null);
          return;
        }

        if (r.extra[0] === 'edit') {
          await clientForm(r.id);
          return;
        }

        await clientRecord(r.id);
        return;
      }

      if (r.name === 'cases') {
        if (!r.id) {
          await casesList();
          return;
        }

        if (r.id === 'new') {
          await caseForm(null);
          return;
        }

        if (r.extra[0] === 'edit') {
          await caseForm(r.id);
          return;
        }

        await caseRecord(r.id);
        return;
      }

      if (r.name === 'opponents') {
        if (!r.id) {
          await opponentsList();
          return;
        }

        if (r.id === 'new') {
          await opponentForm(null);
          return;
        }

        if (r.extra[0] === 'edit') {
          await opponentForm(r.id);
          return;
        }

        await opponentRecord(r.id);
        return;
      }

      if (r.name === 'search') {
        await universalSearch();
        return;
      }

      if (
        r.name === 'hearings' ||
        r.name === 'procedures' ||
        r.name === 'judgments' ||
        r.name === 'reports' ||
        r.name === 'backup' ||
        r.name === 'settings'
      ) {
        activateNav(r.name);
        view.innerHTML =
          pageHead(
            r.name === 'hearings' ? 'الجلسات' :
            r.name === 'procedures' ? 'الإجراءات' :
            r.name === 'judgments' ? 'الأحكام' :
            r.name === 'reports' ? 'التقارير' :
            r.name === 'backup' ? 'النسخ الاحتياطي' :
            'الإعدادات'
          ) +

          '<div class="warn-banner">' +
            'هذه الوحدة سيتم استكمال وظائفها في المرحلة التالية.' +
          '</div>';
        return;
      }

      go('dashboard');

    } catch (err) {
      console.error(err);

      view.innerHTML =
        '<div class="warn-banner">' +
          '<strong>حدث خطأ أثناء تشغيل الصفحة.</strong><br>' +
          esc(err && err.message ? err.message : err) +
        '</div>';
    }
  }

  /* =========================================================
     MOBILE NAV
     ========================================================= */

  var navToggle = document.getElementById('nav-toggle');

  if (navToggle) {
    navToggle.addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
    });
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('.nav-link');

    if (link && window.innerWidth <= 860) {
      document.body.classList.remove('nav-open');
    }
  });

  /* =========================================================
     BOOT
     ========================================================= */

  async function boot() {
    view.innerHTML =
      '<div class="loading">جارٍ تشغيل نظام إدارة المكتب...</div>';

    try {
      await DB.open();
      await loadLookups();

      window.addEventListener('hashchange', renderRoute);

      if (!location.hash) {
        location.hash = '#/dashboard';
      } else {
        await renderRoute();
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
          .catch(function (err) {
            console.warn(
              'Service Worker registration failed:',
              err
            );
          });
      }

    } catch (err) {
      console.error(err);

      view.innerHTML =
        '<div class="warn-banner">' +
          '<strong>تعذر تشغيل قاعدة البيانات.</strong><br>' +
          esc(err && err.message ? err.message : err) +
        '</div>';
    }
  }

  boot();

})(window.LawOffice);
