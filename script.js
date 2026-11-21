/* ==========================================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงสินค้า + ตัวกรอง mood
   - order.html   : เติมฟอร์มจาก URL + ส่งคำสั่งซื้อไป Apps Script
   - admin.html   : แสดงคำสั่งซื้อจาก Google Sheet (CSV)
   แต่ละส่วนจะทำงานเฉพาะเมื่อพบ element ของหน้านั้นๆ
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     ค่าคงที่
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = 'products.json';

  var APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbz73lh9rppP6nacCT08i4m2fhH09AJNKCHkr2lDLKNP0gJ3z-Cu1PxGBvQ30htFj6in_g/exec';

  var ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQKc7iq4T2vLFzCSnW_gG3J6F1lBZ2Ov-e0I2ZnArG1xE1dlYBM9i7RpgktCSieudWY5ypcC2ztNOzc/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  var MOOD_LABELS = {
    fresh: 'Fresh',
    sweet: 'Sweet',
    confident: 'Confident',
    romance: 'Romance'
  };

  /* ------------------------------------------------------------------------
     ตัวช่วยสร้าง element (ใช้ textContent เสมอ ไม่ใช้ innerHTML กับข้อมูล)
     ------------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ========================================================================
     1) product.html
     ======================================================================== */
  function initProductPage() {
    var filterBar = document.getElementById('filter-bar');
    var productList = document.getElementById('product-list');
    if (!filterBar || !productList) return;

    var products = [];
    var currentMood = 'all';

    function showMessage(text) {
      productList.textContent = '';
      productList.appendChild(el('p', 'text-muted', text));
    }

    function buildOrderUrl(product) {
      var item = product.name + (product.size ? ' ' + product.size : '');
      var query = new URLSearchParams({
        item: item,
        price: String(product.price)
      });
      return 'order.html?' + query.toString();
    }

    function buildCard(product) {
      var card = el('article', 'product-card');
      card.setAttribute('data-mood', product.mood);

      var media = el('div', 'product-card__media');
      var img = el('img');
      img.src = product.image;
      img.alt = product.name;
      img.loading = 'lazy';
      media.appendChild(img);

      var body = el('div', 'product-card__body');

      var mood = el('div', 'product-card__mood');
      mood.appendChild(el('span', 'mood-dot'));
      mood.appendChild(el('span', null, MOOD_LABELS[product.mood] || product.mood));

      var name = el('h3', 'product-card__name', product.name);
      var meta = el(
        'p',
        'product-card__meta',
        product.size ? product.size : product.type === 'rollon' ? 'โรลออน' : ''
      );

      var footer = el('div', 'product-card__footer');
      var price = el('span', 'price', Number(product.price).toLocaleString('th-TH'));
      price.appendChild(el('small', null, 'บาท'));

      var buy = el('a', 'btn btn--small', 'สั่งซื้อ');
      buy.href = buildOrderUrl(product);

      footer.appendChild(price);
      footer.appendChild(buy);

      body.appendChild(mood);
      body.appendChild(name);
      body.appendChild(meta);
      body.appendChild(footer);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function renderProducts() {
      var visible = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });

      productList.textContent = '';
      if (visible.length === 0) {
        showMessage('ยังไม่มีสินค้าในหมวดนี้');
        return;
      }
      visible.forEach(function (p) {
        productList.appendChild(buildCard(p));
      });
    }

    function updateFilterState() {
      var buttons = filterBar.querySelectorAll('.filter');
      Array.prototype.forEach.call(buttons, function (btn) {
        var active = btn.getAttribute('data-filter') === currentMood;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function setMood(mood, updateUrl) {
      currentMood = mood;
      updateFilterState();
      renderProducts();

      if (updateUrl && window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        if (mood === 'all') {
          url.searchParams.delete('mood');
        } else {
          url.searchParams.set('mood', mood);
        }
        window.history.replaceState(null, '', url.toString());
      }
    }

    function buildFilterBar() {
      filterBar.textContent = '';
      MOODS.forEach(function (m) {
        var btn = el('button', 'filter');
        btn.type = 'button';
        btn.setAttribute('data-filter', m.key);
        btn.setAttribute('aria-pressed', 'false');

        if (m.key !== 'all') {
          btn.setAttribute('data-mood', m.key);
          btn.appendChild(el('span', 'mood-dot'));
        }
        btn.appendChild(el('span', null, m.label));

        btn.addEventListener('click', function () {
          setMood(m.key, true);
        });
        filterBar.appendChild(btn);
      });
    }

    buildFilterBar();
    showMessage('กำลังโหลดสินค้า...');

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];

        // อ่าน ?mood=xxx ตอนโหลดหน้า (ถ้าค่าไม่ถูกต้อง ใช้ "ทั้งหมด")
        var requested = new URLSearchParams(window.location.search).get('mood');
        var valid = MOODS.some(function (m) {
          return m.key === requested;
        });
        setMood(valid ? requested : 'all', false);
      })
      .catch(function (error) {
        console.error(error);
        showMessage('ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ========================================================================
     2) order.html
     ======================================================================== */
  function initOrderPage() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    var customerNameEl = document.getElementById('customerName');
    var contactEl = document.getElementById('contact');
    var itemsEl = document.getElementById('items');
    var totalEl = document.getElementById('total');
    var noteEl = document.getElementById('note');

    // --- เติมข้อมูลจาก URL parameter (items และ total) ---
    var params = new URLSearchParams(window.location.search);
    var itemParam = params.get('item');
    var priceParam = params.get('price');

    if (itemParam && itemsEl) {
      itemsEl.value = itemParam;
    }
    if (priceParam !== null && priceParam.trim() !== '' && totalEl) {
      var priceNumber = Number(priceParam);
      if (isFinite(priceNumber)) {
        totalEl.value = String(priceNumber);
      }
    }

    // --- ส่งคำสั่งซื้อ ---
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var payload = {
        customerName: customerNameEl ? customerNameEl.value.trim() : '',
        contact: contactEl ? contactEl.value.trim() : '',
        items: itemsEl ? itemsEl.value.trim() : '',
        total: totalEl ? totalEl.value.trim() : '',
        note: noteEl ? noteEl.value.trim() : ''
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true; // กันกดซ้ำ

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = 'thankyou.html'; })
        .catch(error => {
          console.error(error);
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ========================================================================
     3) admin.html
     ======================================================================== */

  // แปลงข้อความ CSV เป็นอาร์เรย์ 2 มิติ
  // รองรับ: ช่องที่ครอบด้วย "", เครื่องหมาย "" แทน " ในช่อง,
  //         ช่องที่มีเครื่องหมายจุลภาคหรือขึ้นบรรทัดใหม่, ท้ายบรรทัดแบบ \n และ \r\n
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"' && field === '') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    // แถวสุดท้ายที่ไม่มีการขึ้นบรรทัดใหม่ปิดท้าย
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function initAdminPage() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLUMNS = 6;

    function showRow(text) {
      tbody.textContent = '';
      var tr = document.createElement('tr');
      var td = el('td', 'text-muted', text);
      td.colSpan = COLUMNS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showRow('กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // แถวแรกคือหัวคอลัมน์ ตัดทิ้ง และตัดแถวว่างออก
        var data = rows.slice(1).filter(function (r) {
          return r.some(function (cell) {
            return cell.trim() !== '';
          });
        });

        if (data.length === 0) {
          showRow('ยังไม่มีคำสั่งซื้อ');
          return;
        }

        // Apps Script เพิ่มแถวต่อท้ายเรียงตามเวลา → กลับลำดับให้รายการล่าสุดอยู่บนสุด
        data.reverse();

        tbody.textContent = '';
        data.forEach(function (r) {
          var tr = document.createElement('tr');
          for (var i = 0; i < COLUMNS; i++) {
            tr.appendChild(el('td', null, r[i] !== undefined ? r[i] : ''));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showRow('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ------------------------------------------------------------------------
     เริ่มทำงาน
     ------------------------------------------------------------------------ */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
