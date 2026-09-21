/* LawOffice - Database Layer (IndexedDB) */
window.LawOffice = window.LawOffice || {};

(function (L) {
  'use strict';

  L.Constants = {
    APP_NAME: 'مكتب المحاماة',
    APP_VERSION: '1.0.0',
    DB_NAME: 'LawOfficeDB',
    DB_VERSION: 4,
    BACKUP_FORMAT: 'law-office-backup',
    BACKUP_FORMAT_VERSION: 1,
    PAGE_SIZE: 50
  };

  var C = L.Constants;


  /* =========================================================
     UTILS
     ========================================================= */

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  L.Utils = {

    $: function (s) {
      return document.querySelector(s);
    },

    $$: function (s) {
      return Array.prototype.slice.call(
        document.querySelectorAll(s)
      );
    },

    uid: function () {
      if (window.crypto && crypto.randomUUID) {
        return crypto.randomUUID();
      }

      return 'id-' +
        Date.now() +
        '-' +
        Math.random().toString(36).slice(2, 10);
    },

    esc: function (s) {
      if (s === null || s === undefined) {
        return '';
      }

      return String(s).replace(
        /[&<>"']/g,
        function (c) {
          return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          }[c];
        }
      );
    },

    today: function () {
      var d = new Date();

      return d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate());
    },

    nowISO: function () {
      return new Date().toISOString();
    },

    fmtDate: function (iso) {
      if (!iso) {
        return '';
      }

      var p = String(iso)
        .slice(0, 10)
        .split('-');

      return p.length === 3
        ? p[2] + '/' + p[1] + '/' + p[0]
        : iso;
    },

    addDays: function (iso, n) {
      var d = new Date(
        iso + 'T00:00:00'
      );

      d.setDate(
        d.getDate() + n
      );

      return d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate());
    },

    startOfWeek: function (iso) {
      var d = new Date(
        iso + 'T00:00:00'
      );

      var w =
        (d.getDay() + 6) % 7;

      return L.Utils.addDays(
        iso,
        -w
      );
    },

    debounce: function (fn, ms) {
      var t;

      return function () {
        var a = arguments;
        var c = this;

        clearTimeout(t);

        t = setTimeout(
          function () {
            fn.apply(c, a);
          },
          ms || 250
        );
      };
    },

    val: function (id) {
      var e =
        document.getElementById(id);

      return e
        ? e.value.trim()
        : '';
    },

    setVal: function (id, v) {
      var e =
        document.getElementById(id);

      if (e) {
        e.value =
          (v === null || v === undefined)
            ? ''
            : v;
      }
    },

    num: function (v) {
      var n =
        parseInt(v, 10);

      return isNaN(n)
        ? null
        : n;
    }
  };


  var U = L.Utils;


  /* =========================================================
     REQUEST PROMISE
     ========================================================= */

  function reqp(r) {
    return new Promise(
      function (res, rej) {

        r.onsuccess = function () {
          res(r.result);
        };

        r.onerror = function () {
          rej(r.error);
        };

      }
    );
  }


  /* =========================================================
     DATABASE STORES
     ========================================================= */

  var STORES = [
    'clients',
    'cases',
    'caseClients',
    'opponents',
    'caseOpponents',
    'hearings',
    'procedures',
    'judgments',
    'caseEvents',
    'lookups',
    'settings',
    'backupHistory'
  ];


  /* =========================================================
     SCHEMA
     ========================================================= */

  var SCHEMA = {

    clients: {
      indexes: [
        'fullName',
        'nationalId',
        'phone1',
        'phone2',
        'whatsapp',
        'archived',
        'updatedAt'
      ]
    },

    cases: {
      indexes: [
        'caseNumber',
        'caseYear',
        'caseTypeId',
        'litigationDegreeId',
        'court',
        'circuit',
        'caseStatusId',
        'filingDate',
        'archived',
        'updatedAt'
      ]
    },

    caseClients: {
      indexes: [
        'caseId',
        'clientId'
      ]
    },

    opponents: {
      indexes: [
        'fullName',
        'archived',
        'updatedAt'
      ]
    },

    caseOpponents: {
      indexes: [
        'caseId',
        'opponentId'
      ]
    },

    hearings: {
      indexes: [
        'caseId',
        'date',
        'statusId',
        'court'
      ]
    },

    procedures: {
      indexes: [
        'caseId',
        'date',
        'deadline',
        'statusId'
      ]
    },

    judgments: {
      indexes: [
        'caseId',
        'date',
        'statusId'
      ]
    },

    caseEvents: {
      indexes: [
        'caseId',
        'date',
        'typeId'
      ]
    },

    lookups: {
      indexes: [
        'category',
        'code'
      ]
    },

    settings: {
      indexes: []
    },

    backupHistory: {
      indexes: [
        'createdAt'
      ]
    }
  };


  /* =========================================================
     SEED DATA
     ========================================================= */

  var SEED = {

    caseType: [
      'مدني',
      'تجاري',
      'عمالي',
      'أسرة',
      'جنائي',
      'إداري',
      'إيجارات',
      'تعويض',
      'صحة توقيع',
      'صحة ونفاذ',
      'طرد',
      'حيازة',
      'أخرى'
    ],

    caseStatus: [
      'منظورة',
      'محجوزة للحكم',
      'منتهية',
      'مؤرشفة'
    ],

    litigationDegree: [
      'أول درجة',
      'استئناف',
      'نقض',
      'تنفيذ'
    ],

    hearingType: [
      'مرافعة',
      'إعلان',
      'شهود',
      'خبراء',
      'حفظ',
      'أخرى'
    ],

    hearingStatus: [
      'جديدة',
      'تمت',
      'مؤجلة',
      'ملغاة'
    ],

    procedureType: [
      'إعلان',
      'تقديم مستندات',
      'مذكرة',
      'طعن',
      'استخراج صورة رسمية',
      'سداد أمانة خبير',
      'إيداع مذكرة',
      'أخرى'
    ],

    procedureStatus: [
      'جديد',
      'قيد التنفيذ',
      'تم',
      'ملغي'
    ],

    judgmentType: [
      'حكم أول درجة',
      'حكم استئنافي',
      'حكم نقض',
      'قرار',
      'حكم نهائي'
    ],

    judgmentStatus: [
      'صادر',
      'نقض',
      'تأييد',
      'قيد التنفيذ',
      'منفذ'
    ],

    eventType: [
      'حدث مهم',
      'استلام إعلان',
      'ورود تقرير خبير',
      'اجتماع بالعميل',
      'أخرى'
    ],

    clientRole: [
      'مدعي',
      'مدعى عليه',
      'مستأنف',
      'مستأنف ضده',
      'متهم',
      'مجني عليه',
      'طالب',
      'مطلوب ضده',
      'خصم',
      'موكل',
      'أخرى'
    ],

    opponentRole: [
      'مدعى عليه',
      'مدعي',
      'مستأنف ضده',
      'مستأنف',
      'خصم',
      'أخرى'
    ]
  };


  /* =========================================================
     DATABASE
     ========================================================= */

  var _db = null;

  L.DB = {

    open: function () {

      if (_db) {
        return Promise.resolve(_db);
      }

      return new Promise(
        function (res, rej) {

          var r =
            indexedDB.open(
              C.DB_NAME,
              C.DB_VERSION
            );


          r.onupgradeneeded =
            function (e) {

              var db =
                e.target.result;

              Object.keys(SCHEMA)
                .forEach(
                  function (name) {

                    var st;

                    if (
                      !db.objectStoreNames
                        .contains(name)
                    ) {

                      st =
                        db.createObjectStore(
                          name,
                          {
                            keyPath: 'id'
                          }
                        );

                    } else {

                      st =
                        e.target.transaction
                          .objectStore(name);

                    }


                    (
                      SCHEMA[name].indexes ||
                      []
                    ).forEach(
                      function (ix) {

                        if (
                          !st.indexNames
                            .contains(ix)
                        ) {

                          st.createIndex(
                            ix,
                            ix,
                            {
                              unique: false
                            }
                          );

                        }

                      }
                    );

                  }
                );
            };


          r.onsuccess =
            function () {

              _db = r.result;

              res(_db);

            };


          r.onerror =
            function () {
              rej(r.error);
            };

        }
      ).then(
        function (db) {
          return L.DB.seedLookups(db);
        }
      );
    },


    /* =====================================================
       LOOKUPS
       ===================================================== */

    seedLookups: function (db) {

      return L.DB
        .store('lookups')
        .byIndex(
          'category',
          'caseType'
        )
        .then(
          function (rows) {

            if (
              rows &&
              rows.length
            ) {
              return db;
            }


            var jobs = [];
            var order = 1;


            Object.keys(SEED)
              .forEach(
                function (cat) {

                  SEED[cat]
                    .forEach(
                      function (name, i) {

                        jobs.push(
                          L.DB
                            .store('lookups')
                            .add({
                              id: U.uid(),
                              category: cat,
                              code:
                                cat +
                                '-' +
                                (i + 1),
                              name: name,
                              sortOrder:
                                order++,
                              active: true,
                              system: false,
                              createdAt:
                                U.nowISO(),
                              updatedAt:
                                U.nowISO()
                            })
                        );

                      }
                    );

                }
              );


            return Promise.all(jobs)
              .then(
                function () {
                  return db;
                }
              );

          }
        );
    },


    /* =====================================================
       STORE
       ===================================================== */

    store: function (name) {
      return repo(name);
    },


    /* =====================================================
       DUMP
       ===================================================== */

    dump: function () {

      var out = {};

      return STORES.reduce(
        function (p, s) {

          return p
            .then(
              function () {
                return L.DB
                  .store(s)
                  .all();
              }
            )
            .then(
              function (rows) {
                out[s] = rows;
              }
            );

        },
        Promise.resolve()
      )
      .then(
        function () {
          return out;
        }
      );
    },


    /* =====================================================
       REPLACE ALL
       ===================================================== */

    replaceAll: function (data) {

      return L.DB.open()
        .then(
          function (db) {

            return new Promise(
              function (res, rej) {

                /*
                 * نستعيد بيانات المكتب فقط.
                 * backupHistory مستقل حتى لا يضيع سجل
                 * عمليات النسخ والاستعادة.
                 */

                var restoreStores = [
                  'clients',
                  'cases',
                  'caseClients',
                  'opponents',
                  'caseOpponents',
                  'hearings',
                  'procedures',
                  'judgments',
                  'caseEvents',
                  'lookups',
                  'settings'
                ];


                var names =
                  restoreStores.filter(
                    function (s) {
                      return db.objectStoreNames
                        .contains(s);
                    }
                  );


                var t =
                  db.transaction(
                    names,
                    'readwrite'
                  );


                names.forEach(
                  function (s) {

                    var st =
                      t.objectStore(s);

                    st.clear();


                    (
                      data &&
                      Array.isArray(data[s])
                        ? data[s]
                        : []
                    )
                    .forEach(
                      function (row) {
                        st.put(row);
                      }
                    );

                  }
                );


                t.oncomplete =
                  function () {
                    res();
                  };


                t.onerror =
                  function () {
                    rej(t.error);
                  };


                t.onabort =
                  function () {
                    rej(
                      t.error ||
                      new Error(
                        'restore aborted'
                      )
                    );
                  };

              }
            );

          }
        );
    },


    /* =====================================================
       SETTINGS
       ===================================================== */

    getSetting: function (key, def) {

      return L.DB
        .store('settings')
        .get(key)
        .then(
          function (r) {
            return r
              ? r.value
              : def;
          }
        );
    },


    setSetting: function (key, value) {

      return L.DB
        .store('settings')
        .put({
          id: key,
          key: key,
          value: value,
          updatedAt: U.nowISO()
        });

    }

  };


  /* =========================================================
     TRANSACTION RUNNER
     ========================================================= */

  function run(stores, mode, fn) {

    return L.DB.open()
      .then(
        function (db) {

          return new Promise(
            function (res, rej) {

              var t =
                db.transaction(
                  stores,
                  mode
                );

              var result;


              Promise.resolve(
                fn(t)
              )
              .then(
                function (v) {
                  result = v;
                }
              )
              .catch(rej);


              t.oncomplete =
                function () {
                  res(result);
                };


              t.onerror =
                function () {
                  rej(t.error);
                };


              t.onabort =
                function () {
                  rej(
                    t.error ||
                    new Error(
                      'transaction aborted'
                    )
                  );
                };

            }
          );

        }
      );
  }


  /* =========================================================
     REPOSITORY
     ========================================================= */

  function repo(name) {

    return {

      add: function (o) {

        o.id =
          o.id ||
          U.uid();

        o.createdAt =
          o.createdAt ||
          U.nowISO();

        o.updatedAt =
          U.nowISO();


        return run(
          name,
          'readwrite',
          function (t) {

            return reqp(
              t.objectStore(name)
                .add(o)
            );

          }
        );
      },


      put: function (o) {

        o.updatedAt =
          U.nowISO();


        return run(
          name,
          'readwrite',
          function (t) {

            return reqp(
              t.objectStore(name)
                .put(o)
            );

          }
        );
      },


      get: function (id) {

        return run(
          name,
          'readonly',
          function (t) {

            return reqp(
              t.objectStore(name)
                .get(id)
            );

          }
        );
      },


      all: function () {

        return run(
          name,
          'readonly',
          function (t) {

            return reqp(
              t.objectStore(name)
                .getAll()
            );

          }
        );
      },


      byIndex: function (ix, val) {

        return run(
          name,
          'readonly',
          function (t) {

            return reqp(
              t.objectStore(name)
                .index(ix)
                .getAll(val)
            );

          }
        );
      },


      del: function (id) {

        return run(
          name,
          'readwrite',
          function (t) {

            return reqp(
              t.objectStore(name)
                .delete(id)
            );

          }
        );
      },


      clear: function () {

        return run(
          name,
          'readwrite',
          function (t) {

            return reqp(
              t.objectStore(name)
                .clear()
            );

          }
        );
      },


      count: function () {

        return run(
          name,
          'readonly',
          function (t) {

            return reqp(
              t.objectStore(name)
                .count()
            );

          }
        );
      }

    };
  }


  /* =========================================================
     PUBLIC REPOSITORIES
     ========================================================= */

  L.Repo = {};

  STORES.forEach(
    function (s) {
      L.Repo[s] = repo(s);
    }
  );

})(window.LawOffice);
