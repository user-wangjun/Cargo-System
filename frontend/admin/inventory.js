initTheme(); initSidebar(); initNavbar(); initMobileDrawer();
    const state = { suppliers:[], customers:[], products:[], salesOrders:[], warehouses:[], purchaseReceipts:[], deliveryOrders:[], balances:[], ledger:[], conversions:[], purchasePage:1, deliveryPage:1, warehousePage:1, pageSize:10 };

    function listData(res){ return res?.data?.list || res?.data || []; }
    function fmt(d){ return d ? String(d).slice(0,10) : "-"; }
    function findById(list, id){ return list.find((x)=>String(x.id)===String(id)); }
    function warehouseOptions(){
      return state.warehouses.map((x)=>({ id: x.id, name: x.name || x.warehouseCode || x.id }));
    }
    function switchTab(tab){ ["purchase","delivery","warehouse","balance","ledger"].forEach((x)=>{ document.getElementById("tab-"+x).classList.toggle("active",x===tab); document.getElementById("tab-"+x+"-btn").classList.toggle("active",x===tab); }); }
    window.switchTab = switchTab;

    function lineOptions(){
      const rows = [{ id:"", text:"无关联", orderedQty:0, unitId:"" }];
      state.salesOrders.forEach((o)=> (o.items||[]).forEach((i)=> {
        const p = state.products.find((x)=>String(x.id)===String(i.productId));
        const unitText = (p && (p.baseUnitCode || p.baseUnit)) || i.unitCode || i.unitId || "";
        rows.push({ id:i.id || (o.id+"-"+i.lineNo), text:(o.orderNo||o.id)+" / "+(i.productName||i.productId)+" / "+(i.orderedQty||0)+(unitText ? (" "+unitText) : ""), orderedQty:i.orderedQty, unitId:i.unitId });
      }));
      return rows;
    }

    const IMPORT_HEADERS = {
      supplier: ["供应商", "供应商编码", "供应商id", "supplier", "suppliercode", "supplierid"],
      receiptDate: ["交货日期", "收货日期", "日期", "receiptdate", "date"],
      product: ["商品", "商品编码", "商品id", "product", "productcode", "productid"],
      quantity: ["数量", "收货数量", "receivedqty", "qty", "quantity"],
      unit: ["供应商单位", "单位", "unit", "unitid", "unitcode"],
      remarks: ["备注", "remarks", "remark"],
      relatedSalesOrderItemId: ["关联销售订单行id", "销售订单行id", "relatedsalesorderitemid"],
      group: ["导入分组", "收货单分组", "group", "groupkey", "batch", "批次", "收货单号"]
    };

    function normalizeImportToken(value){
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_：:（）()\[\]【】\-]/g, "");
    }

    function toImportDate(value){
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return getLocalDateInputValue(value);
      }

      if (typeof value === "number" && Number.isFinite(value) && window.XLSX?.SSF?.parse_date_code) {
        const parsed = window.XLSX.SSF.parse_date_code(value);
        if (parsed?.y && parsed?.m && parsed?.d) {
          return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
      }

      const text = String(value || "").trim();
      if (!text) return "";

      if (/^\d+(\.\d+)?$/.test(text) && window.XLSX?.SSF?.parse_date_code) {
        const parsed = window.XLSX.SSF.parse_date_code(Number(text));
        if (parsed?.y && parsed?.m && parsed?.d) {
          return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
      }

      const normalized = text.replace(/[./]/g, "-");
      const strictDate = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (strictDate) {
        return `${strictDate[1]}-${strictDate[2].padStart(2, "0")}-${strictDate[3].padStart(2, "0")}`;
      }

      const parsedDate = new Date(text);
      if (!Number.isNaN(parsedDate.getTime())) {
        return getLocalDateInputValue(parsedDate);
      }
      return "";
    }

    function pickImportCell(row, aliases){
      const aliasSet = new Set((aliases || []).map(normalizeImportToken));
      for (const [key, value] of Object.entries(row || {})) {
        if (aliasSet.has(normalizeImportToken(key))) return value;
      }
      return "";
    }

    function normalizeImportText(value){
      return String(value || "").trim().toLowerCase();
    }

    function resolveImportEntity(list, value, label, tokenGetter, labelGetter){
      const keyword = String(value || "").trim();
      if (!keyword) {
        throw new Error(`${label}不能为空`);
      }
      const normalized = normalizeImportText(keyword);
      const rows = Array.isArray(list) ? list : [];
      const exact = rows.filter((item) => tokenGetter(item).some((token) => normalizeImportText(token) === normalized));
      if (exact.length === 1) return exact[0];
      if (exact.length > 1) {
        const samples = exact.slice(0, 3).map((item) => labelGetter(item)).join("、");
        throw new Error(`${label}“${keyword}”匹配到多个：${samples}`);
      }

      const fuzzy = rows.filter((item) => tokenGetter(item).some((token) => normalizeImportText(token).includes(normalized)));
      if (fuzzy.length === 1) return fuzzy[0];
      if (fuzzy.length > 1) {
        const samples = fuzzy.slice(0, 3).map((item) => labelGetter(item)).join("、");
        throw new Error(`${label}“${keyword}”匹配到多个：${samples}`);
      }
      throw new Error(`${label}“${keyword}”不存在`);
    }

    function formatSupplierLabel(supplier){
      const name = supplier?.name || supplier?.supplierName || supplier?.id || "";
      const code = supplier?.supplierCode ? `（${supplier.supplierCode}）` : "";
      return `${name}${code}`;
    }

    function formatProductLabel(product){
      const name = product?.name || product?.productName || product?.id || "";
      const code = product?.productCode ? `（${product.productCode}）` : "";
      const spec = product?.spec ? ` - ${product.spec}` : "";
      return `${name}${code}${spec}`;
    }

    function resolveImportUnitId(product, rawUnit){
      const baseUnitId = String(product?.baseUnitId || "").trim();
      if (!baseUnitId) {
        throw new Error(`商品“${formatProductLabel(product)}”缺少基础单位`);
      }

      const unitText = String(rawUnit || "").trim();
      if (!unitText) return baseUnitId;

      const normalized = normalizeImportText(unitText);
      const baseTokens = [baseUnitId, product?.baseUnitCode, product?.baseUnitName, product?.baseUnit];
      const matchedBase = baseTokens.some((token) => normalizeImportText(token) === normalized || normalizeImportText(token).includes(normalized));
      if (matchedBase) return baseUnitId;

      const conversionRows = state.conversions.filter(
        (row) => String(row?.productId || "") === String(product?.id || "") && String(row?.toUnit || "") === baseUnitId
      );
      const exact = conversionRows.find((row) => {
        const tokens = [row?.fromUnit, row?.fromUnitCode, row?.fromUnitName].map((token) => normalizeImportText(token));
        return tokens.includes(normalized);
      });
      if (exact?.fromUnit) return String(exact.fromUnit);

      const fuzzy = conversionRows.filter((row) => {
        const tokens = [row?.fromUnit, row?.fromUnitCode, row?.fromUnitName].map((token) => normalizeImportText(token));
        return tokens.some((token) => token.includes(normalized));
      });
      if (fuzzy.length === 1 && fuzzy[0]?.fromUnit) {
        return String(fuzzy[0].fromUnit);
      }
      if (fuzzy.length > 1) {
        const samples = fuzzy.slice(0, 3).map((row) => row?.fromUnitCode || row?.fromUnitName || row?.fromUnit).join("、");
        throw new Error(`商品“${formatProductLabel(product)}”的单位“${unitText}”匹配到多个：${samples}`);
      }
      throw new Error(`商品“${formatProductLabel(product)}”的单位“${unitText}”不存在`);
    }

    function createSalesOrderItemLookup(){
      const map = new Map();
      state.salesOrders.forEach((order) => {
        (order?.items || []).forEach((item) => {
          const orderNo = String(order?.orderNo || order?.id || "").trim();
          const lineNo = String(item?.lineNo || "").trim();
          const itemId = String(item?.id || "").trim();
          const candidates = [itemId];
          if (orderNo && lineNo) {
            candidates.push(`${orderNo}-${lineNo}`, `${orderNo}/${lineNo}`, `${orderNo}#${lineNo}`);
          }
          candidates
            .map((token) => normalizeImportToken(token))
            .filter(Boolean)
            .forEach((token) => {
              if (!map.has(token)) map.set(token, itemId);
            });
        });
      });
      return map;
    }

    function resolveImportSalesOrderItemId(rawValue, lookup){
      const text = String(rawValue || "").trim();
      if (!text) return "";
      const id = lookup.get(normalizeImportToken(text));
      if (!id) throw new Error(`关联销售订单行“${text}”不存在`);
      return id;
    }

    function showImportResultModal(title, lines){
      showModal({
        title,
        body: `<div style="max-height:320px;overflow:auto;line-height:1.7;">${lines.map((line) => _escHtml(line)).join("<br/>")}</div>`,
        footer: `<button class="btn btn--primary btn--sm" onclick="closeModal()">我知道了</button>`
      });
    }

    function buildPurchaseImportPayloads(rows){
      const groups = new Map();
      const errors = [];
      const salesOrderLookup = createSalesOrderItemLookup();

      rows.forEach((row, index) => {
        const rowNo = index + 2;
        try {
          const supplierRaw = pickImportCell(row, IMPORT_HEADERS.supplier);
          const dateRaw = pickImportCell(row, IMPORT_HEADERS.receiptDate);
          const productRaw = pickImportCell(row, IMPORT_HEADERS.product);
          const qtyRaw = pickImportCell(row, IMPORT_HEADERS.quantity);
          const unitRaw = pickImportCell(row, IMPORT_HEADERS.unit);
          const remarksRaw = pickImportCell(row, IMPORT_HEADERS.remarks);
          const groupRaw = pickImportCell(row, IMPORT_HEADERS.group);
          const relatedRaw = pickImportCell(row, IMPORT_HEADERS.relatedSalesOrderItemId);

          const supplier = resolveImportEntity(
            state.suppliers,
            supplierRaw,
            "供应商",
            (item) => [item?.id, item?.supplierCode, item?.name, item?.supplierName],
            formatSupplierLabel
          );
          const product = resolveImportEntity(
            state.products,
            productRaw,
            "商品",
            (item) => [item?.id, item?.productCode, item?.name, item?.productName],
            formatProductLabel
          );

          const receiptDate = toImportDate(dateRaw);
          if (!receiptDate) throw new Error(`交货日期“${String(dateRaw || "").trim()}”格式不正确`);

          const qty = Number(String(qtyRaw ?? "").replace(/,/g, "").trim());
          if (!Number.isFinite(qty) || qty <= 0) throw new Error(`数量“${String(qtyRaw || "").trim()}”不合法`);

          const unitId = resolveImportUnitId(product, unitRaw);
          const relatedSalesOrderItemId = resolveImportSalesOrderItemId(relatedRaw, salesOrderLookup);
          const remarks = String(remarksRaw || "").trim();
          const groupLabel = String(groupRaw || "").trim();
          const groupKey = groupLabel || `${supplier.id}__${receiptDate}__${remarks}`;

          if (!groups.has(groupKey)) {
            groups.set(groupKey, {
              supplierId: supplier.id,
              supplierLabel: formatSupplierLabel(supplier),
              receiptDate,
              remarks,
              groupLabel,
              items: []
            });
          }
          const group = groups.get(groupKey);
          if (String(group.supplierId) !== String(supplier.id)) {
            throw new Error("同一分组内供应商不一致");
          }
          if (String(group.receiptDate) !== String(receiptDate)) {
            throw new Error("同一分组内交货日期不一致");
          }
          group.items.push({
            productId: product.id,
            receivedQty: qty,
            unitId,
            relatedSalesOrderItemId: relatedSalesOrderItemId || null
          });
        } catch (error) {
          errors.push(`第${rowNo}行：${error instanceof Error ? error.message : "解析失败"}`);
        }
      });

      if (errors.length) {
        throw errors;
      }

      return Array.from(groups.values()).map((group) => ({
        supplierId: group.supplierId,
        receiptDate: group.receiptDate,
        remarks: group.remarks,
        supplierLabel: group.supplierLabel,
        groupLabel: group.groupLabel,
        items: group.items.map((item, idx) => ({
          lineNo: idx + 1,
          productId: item.productId,
          receivedQty: item.receivedQty,
          unitId: item.unitId,
          relatedSalesOrderItemId: item.relatedSalesOrderItemId
        }))
      }));
    }

    async function submitPurchaseImportPayloads(payloads){
      const failures = [];
      let successCount = 0;

      for (let i = 0; i < payloads.length; i += 1) {
        const payload = payloads[i];
        const label = payload.groupLabel
          ? `分组“${payload.groupLabel}”`
          : `${payload.supplierLabel} / ${payload.receiptDate}`;
        try {
          await request("/purchase-receipts", {
            method: "POST",
            body: JSON.stringify({
              supplierId: payload.supplierId,
              receiptDate: payload.receiptDate,
              remarks: payload.remarks,
              items: payload.items
            })
          });
          successCount += 1;
        } catch (error) {
          failures.push(`第${i + 1}单（${label}）：${getErrorMessage(error)}`);
        }
      }

      if (successCount > 0) {
        await loadPurchase();
      }

      if (failures.length) {
        showImportResultModal("导入结果（含失败）", failures);
      }
      showToast(
        failures.length ? "warning" : "success",
        `导入完成：成功 ${successCount} 单，失败 ${failures.length} 单`
      );
    }

    async function handlePurchaseImportFile(file){
      if (!window.XLSX) {
        throw new Error("Excel 解析组件未加载，请刷新页面后重试");
      }

      const buffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook?.SheetNames?.[0];
      if (!firstSheetName) throw new Error("Excel 中没有可读取的工作表");

      const sheet = workbook.Sheets[firstSheetName];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
      if (!rows.length) throw new Error("Excel 为空，请至少填写一行数据");

      let payloads = [];
      try {
        payloads = buildPurchaseImportPayloads(rows);
      } catch (error) {
        if (Array.isArray(error)) {
          showImportResultModal("Excel 数据校验失败", error.slice(0, 30));
          throw new Error(`发现 ${error.length} 处数据问题，请修正后重试`);
        }
        throw error;
      }
      if (!payloads.length) throw new Error("未解析到可导入的数据");

      const totalLines = payloads.reduce((sum, item) => sum + item.items.length, 0);
      showConfirm(`即将导入 ${totalLines} 行数据，生成 ${payloads.length} 张收货单，是否继续？`, () => {
        submitPurchaseImportPayloads(payloads).catch((error) => {
          showToast("error", `导入执行失败：${getErrorMessage(error)}`);
        });
      });
    }

    async function onPurchaseImportChange(event){
      const input = event?.target;
      const file = input?.files?.[0];
      if (!file) return;
      try {
        await handlePurchaseImportFile(file);
      } catch (error) {
        showToast("error", `导入失败：${getErrorMessage(error)}`);
      } finally {
        input.value = "";
      }
    }

    function triggerPurchaseImport(){
      if (!hasPermission("inventory.edit")) {
        showToast("error", "当前账号没有导入权限");
        return;
      }
      const input = document.getElementById("purchaseImportFile");
      if (!input) {
        showToast("error", "未找到导入控件，请刷新页面后重试");
        return;
      }
      input.click();
    }
    window.triggerPurchaseImport = triggerPurchaseImport;

    function openPurchaseModal(){
      const today = getLocalDateInputValue();
      const rows = [{ productId:"", productKeyword:"", supplierQty:1, supplierUnitId:"", supplierUnitCode:"", relatedSalesOrderItemId:"" }];
      const normalizeKeyword = (value) => String(value || "").trim().toLowerCase();
      const getSupplierLabel = (supplier) => {
        const name = supplier?.name || supplier?.supplierName || supplier?.id || "";
        const code = supplier?.supplierCode ? `（${supplier.supplierCode}）` : "";
        return `${name}${code}`;
      };
      const getProductLabel = (product) => {
        const name = product?.name || product?.productName || product?.id || "";
        const code = product?.productCode ? `（${product.productCode}）` : "";
        const spec = product?.spec ? ` - ${product.spec}` : "";
        return `${name}${code}${spec}`;
      };
      const filterProductsByKeyword = (keyword = "") => {
        const normalized = normalizeKeyword(keyword);
        if (!normalized) return state.products;
        return state.products.filter((p) => {
          const text = `${p?.name || ""} ${p?.productCode || ""} ${p?.spec || ""} ${p?.color || ""} ${p?.id || ""}`.toLowerCase();
          return text.includes(normalized);
        });
      };
      const getKnownBaseUnitOptions = () => {
        const map = new Map();
        state.products.forEach((p) => {
          const unitId = String(p?.baseUnitId || "").trim();
          if (!unitId || map.has(unitId)) return;
          const unitCode = String(p?.baseUnitCode || p?.baseUnit || "").trim();
          const unitName = String(p?.baseUnitName || "").trim();
          const label = unitCode && unitName && unitCode !== unitName
            ? `${unitCode}（${unitName}）`
            : (unitCode || unitName || unitId);
          map.set(unitId, { id: unitId, code: unitCode, name: unitName, label });
        });
        return Array.from(map.values());
      };
      const resolveBaseUnit = (input, unitOptions) => {
        const keyword = normalizeKeyword(input);
        if (!keyword) return null;
        const exact = unitOptions.find((unit) => {
          const targets = [unit.id, unit.code, unit.name, unit.label].map((v) => normalizeKeyword(v));
          return targets.includes(keyword);
        });
        if (exact) return exact;
        return unitOptions.find((unit) => {
          const targets = [unit.id, unit.code, unit.name, unit.label].map((v) => normalizeKeyword(v));
          return targets.some((text) => text.includes(keyword));
        }) || null;
      };
      const supplierOptions = (keyword = "") => {
        const normalized = normalizeKeyword(keyword);
        const list = !normalized
          ? state.suppliers
          : state.suppliers.filter((s) => {
              const name = s?.name || s?.supplierName || "";
              const code = s?.supplierCode || "";
              const id = s?.id || "";
              const text = `${name} ${code} ${id}`.toLowerCase();
              return text.includes(normalized);
            });
        const optionList = list.length
          ? list.map((s)=>`<option value="${_escAttr(s.id)}">${_escHtml(getSupplierLabel(s))}</option>`).join("")
          : `<option value="">未找到匹配供应商</option>`;
        return `<option value="">请选择供应商</option>${optionList}`;
      };
      const renderSupplierSelect = (keyword = "", preferredId = "") => {
        const sel = document.getElementById("prSupplier");
        if (!sel) return;
        const previous = preferredId || sel.value || "";
        sel.innerHTML = supplierOptions(keyword);
        const hasPreferred = previous && Array.from(sel.options).some((o) => String(o.value) === String(previous));
        sel.value = hasPreferred ? String(previous) : "";
      };
      const renderRows = ()=> {
        const options = lineOptions();
        document.getElementById("purchaseItems").innerHTML = rows.map((r,idx)=>{
          const line = options.find((x)=>String(x.id)===String(r.relatedSalesOrderItemId));
          const converted = line ? calcConvertedQty(Number(r.supplierQty||0), r.supplierUnitId, line.unitId, state.conversions) : "";
          const keyword = r.productKeyword || "";
          const productList = filterProductsByKeyword(keyword);
          const selectedProduct = state.products.find((p)=>String(p.id)===String(r.productId));
          const selectedMissing = selectedProduct && !productList.some((p)=>String(p.id)===String(r.productId));
          const productOptions = [
            `<option value=''>请选择商品</option>`,
            selectedMissing ? `<option value="${_escAttr(selectedProduct.id)}" selected>${_escHtml(getProductLabel(selectedProduct))}</option>` : "",
            productList.length
              ? productList.map((p)=>`<option value="${_escAttr(p.id)}" ${String(p.id)===String(r.productId)?"selected":""}>${_escHtml(getProductLabel(p))}</option>`).join("")
              : (!selectedMissing ? `<option value="">未找到匹配商品</option>` : ""),
          ].join("");
          return `<tr>
            <td>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;gap:6px;">
                  <input class="form-input" value="${_escAttr(keyword)}" placeholder="搜索商品名称/编码/规格" oninput="window._pUpd(${idx},'productKeyword',this.value)" />
                  <button class="btn btn--default btn--sm" type="button" onclick="window._quickAddProduct(${idx})">新增商品</button>
                </div>
                <select class="form-select" onchange="window._pUpd(${idx},'productId',this.value)">${productOptions}</select>
              </div>
            </td>
            <td><input class="form-input" type="number" min="1" step="1" value="${r.supplierQty}" onchange="window._pUpd(${idx},'supplierQty',this.value)" /></td>
            <td><input class="form-input" value="${r.supplierUnitCode||r.supplierUnitId||""}" onchange="window._pUpd(${idx},'supplierUnitCode',this.value)" /></td>
            <td><select class="form-select" onchange="window._pUpd(${idx},'relatedSalesOrderItemId',this.value)">${options.map((o)=>`<option value="${_escAttr(o.id)}" ${String(o.id)===String(r.relatedSalesOrderItemId)?"selected":""}>${_escHtml(o.text)}</option>`).join("")}</select></td>
            <td>${line ? (line.orderedQty||0)+" "+(line.unitId||"") : "-"}</td>
            <td>${line ? Number(converted||0).toFixed(4) : "-"}</td>
            <td><button class="btn btn--icon" onclick="window._pDel(${idx})">🗑️</button></td>
          </tr>`;
        }).join("");
      };
      window._pUpd=(idx,key,val)=>{
        rows[idx][key]=val;
        if(key==="productId"){
          const p=state.products.find((x)=>String(x.id)===String(val));
          if(p){
            rows[idx].supplierUnitId = p.baseUnitId || rows[idx].supplierUnitId || "";
            rows[idx].supplierUnitCode = p.baseUnitCode || p.baseUnit || rows[idx].supplierUnitCode || "";
            rows[idx].productKeyword = p.name || p.productCode || "";
          }
        }
        renderRows();
      };
      window._pDel=(idx)=>{ rows.splice(idx,1); renderRows(); };
      window._pAdd=()=>{ rows.push({ productId:"", productKeyword:"", supplierQty:1, supplierUnitId:"", supplierUnitCode:"", relatedSalesOrderItemId:"" }); renderRows(); };

      showModal({
        title:"新建采购收货单",
        body:`<div class="form-item"><label class="form-label form-label--required">供应商</label><div style="display:flex;gap:8px;align-items:flex-start;"><div style="flex:1;display:flex;flex-direction:column;gap:8px;"><input class="form-input" id="prSupplierKeyword" placeholder="输入供应商名称/编码关键字搜索" /><select class="form-select" id="prSupplier">${supplierOptions()}</select></div><button class="btn btn--default btn--sm" type="button" onclick="window._quickAddSupplier()">快速新增</button></div><span class="form-error" id="err-prSupplier"></span></div>
          <div class="form-item"><label class="form-label form-label--required">交货日期</label><input class="form-input" id="prDate" type="date" value="${today}" /><span class="form-error" id="err-prDate"></span></div>
          <div class="form-item"><label class="form-label">备注</label><input class="form-input" id="prRemarks" /></div>
          <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;"><strong>明细行</strong><button class="btn btn--default btn--sm" onclick="window._pAdd()">添加行</button></div>
          <span class="form-error" id="err-prItems"></span>
          <table class="items-table"><thead><tr><th>商品</th><th>数量</th><th>供应商单位</th><th>关联销售订单行</th><th>客户订购数量</th><th>折算数量</th><th>操作</th></tr></thead><tbody id="purchaseItems"></tbody></table>`,
        footer:`<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="window._savePr()">提交</button>`
      });
      const supplierKeywordInput = document.getElementById("prSupplierKeyword");
      if (supplierKeywordInput) {
        supplierKeywordInput.addEventListener("input", (e) => {
          renderSupplierSelect(e.target?.value || "");
        });
      }
      renderRows();
      window._quickAddSupplier = async ()=>{
        const supplierCode = (window.prompt("请输入供应商编码（唯一）") || "").trim();
        if(!supplierCode) return;
        const name = (window.prompt("请输入供应商名称") || "").trim();
        if(!name){ showToast("error","供应商名称不能为空"); return; }
        try{
          const createdRes = await request("/suppliers",{ method:"POST", body: JSON.stringify({ supplierCode, name }) });
          const created = createdRes?.data || createdRes;
          if(created && created.id){
            state.suppliers = [created, ...state.suppliers.filter((x)=>String(x.id)!==String(created.id))];
          }else{
            const sRes = await request("/suppliers");
            state.suppliers = listData(sRes);
          }
          const sel = document.getElementById("prSupplier");
          if(sel){
            const keywordInput = document.getElementById("prSupplierKeyword");
            if (keywordInput) keywordInput.value = "";
            renderSupplierSelect("", created && created.id ? String(created.id) : "");
          }
          showToast("success","供应商新增成功");
        }catch(err){
          showToast("error","新增供应商失败："+(err?.message||"未知错误"));
        }
      };
      window._quickAddProduct = async (idx)=>{
        const productCode = (window.prompt("请输入商品编码（唯一）") || "").trim();
        if(!productCode) return;
        const duplicated = state.products.some((p)=>String(p.productCode || "").trim().toLowerCase() === productCode.toLowerCase());
        if(duplicated){
          showToast("error","商品编码已存在，请更换后重试");
          return;
        }
        const name = (window.prompt("请输入商品名称") || "").trim();
        if(!name){
          showToast("error","商品名称不能为空");
          return;
        }

        const unitOptions = getKnownBaseUnitOptions();
        if(!unitOptions.length){
          showToast("error","暂无可复用基础单位，请先在商品管理中创建一个带基础单位的商品");
          return;
        }
        const unitExample = unitOptions.slice(0, 6).map((unit)=>unit.code || unit.name || unit.id).join("、");
        const unitInput = (window.prompt(`请输入基础单位（支持编码/名称关键字，例如：${unitExample}）`, unitOptions[0].code || unitOptions[0].name || unitOptions[0].id) || "").trim();
        if(!unitInput){
          showToast("error","基础单位不能为空");
          return;
        }
        const baseUnit = resolveBaseUnit(unitInput, unitOptions);
        if(!baseUnit){
          showToast("error",`未识别基础单位：${unitInput}`);
          return;
        }

        try{
          const payload = { productCode, name, baseUnitId: baseUnit.id };
          const createdRes = await request("/products", { method:"POST", body: JSON.stringify(payload) });
          const created = createdRes?.data || createdRes;
          if(created && created.id){
            state.products = [created, ...state.products.filter((x)=>String(x.id)!==String(created.id))];
          }else{
            const proRes = await request("/products");
            state.products = listData(proRes);
          }

          const selected = created && created.id
            ? state.products.find((p)=>String(p.id)===String(created.id))
            : state.products.find((p)=>String(p.productCode || "").trim().toLowerCase()===productCode.toLowerCase());
          if(typeof idx === "number" && rows[idx] && selected){
            rows[idx].productId = selected.id;
            rows[idx].productKeyword = selected.name || selected.productCode || "";
            rows[idx].supplierUnitId = selected.baseUnitId || rows[idx].supplierUnitId || "";
            rows[idx].supplierUnitCode = selected.baseUnitCode || selected.baseUnit || rows[idx].supplierUnitCode || "";
          }
          renderRows();
          showToast("success","商品新增成功");
        }catch(err){
          showToast("error","新增商品失败："+(err?.message||"未知错误"));
        }
      };
      window._savePr = async ()=>{
        clearFieldErrors(["prSupplier","prDate","prItems"]);
        const supplierId = document.getElementById("prSupplier").value;
        const receiptDate = document.getElementById("prDate").value;
        const hasInvalid = rows.some((r)=>!r.productId);
        if(!supplierId) showFieldError("prSupplier","请选择供应商");
        if(!receiptDate) showFieldError("prDate","请选择交货日期");
        if(!rows.length || hasInvalid) showFieldError("prItems","请至少添加一行完整商品");
        if(!supplierId || !receiptDate || !rows.length || hasInvalid) return;
        try{
          await request("/purchase-receipts",{ method:"POST", body: JSON.stringify({ supplierId, receiptDate, remarks: document.getElementById("prRemarks").value.trim(), items: rows.map((r,i)=>({ lineNo:i+1, productId:r.productId, receivedQty:Number(r.supplierQty||0), unitId:r.supplierUnitId, relatedSalesOrderItemId:r.relatedSalesOrderItemId||null })) }) });
          closeModal(); showToast("success","收货单创建成功"); await loadPurchase();
        }catch(err){ showToast("error","收货单创建失败："+(err?.message||"未知错误")); }
      };
    }
    window.openPurchaseModal = openPurchaseModal;

    function getAvail(productId){
      const m = state.balances.find((x)=>String(x.productId)===String(productId));
      return m ? Number(m.availableQty || 0) : null;
    }
    async function reloadWarehouseRelated(){
      await Promise.all([loadWarehouses(), loadDelivery(), loadBalances()]);
    }
    async function runInventoryAction(action, successMessage, failurePrefix, reloaders = []){
      try{
        await action();
        if(successMessage) showToast("success", successMessage);
        if(reloaders.length){
          await Promise.all(reloaders.map((loader)=>loader()));
        }
      }catch(err){
        showToast("error", `${failurePrefix}：${getErrorMessage(err)}`);
      }
    }
    function openDeliveryModal(editId){
      if(!editId && !state.warehouses.length){
        showToast("error","请先在仓库管理中创建至少一个仓库");
        switchTab("warehouse");
        return;
      }
      const editing = findById(state.deliveryOrders, editId) || null;
      const rows = editing
        ? (editing.items || []).map((i) => {
            const p = state.products.find((x) => String(x.id) === String(i.productId));
            return {
              productId: i.productId || "",
              deliveredQty: i.deliveredQty || 1,
              unitId: i.unitId || "",
              unitCode: (p && (p.baseUnitCode || p.baseUnit)) || i.unitCode || i.unitId || "",
              relatedSalesOrderItemId: i.relatedSalesOrderItemId || "",
            };
          })
        : [{ productId: "", deliveredQty: 1, unitId: "", unitCode: "", relatedSalesOrderItemId: "" }];
      const today = getLocalDateInputValue();
      const renderRows = ()=>{
        const options = lineOptions();
        document.getElementById("deliveryItems").innerHTML = rows.map((r,idx)=>{
          const avail = r.productId ? getAvail(r.productId) : null;
          return `<tr>
            <td><select class="form-select" onchange="window._dUpd(${idx},'productId',this.value)"><option value=''>请选择商品</option>${state.products.map((p)=>`<option value="${_escAttr(p.id)}" ${String(p.id)===String(r.productId)?"selected":""}>${_escHtml(formatProductOption(p))}</option>`).join("")}</select></td>
            <td><input class="form-input" type="number" min="1" step="1" value="${r.deliveredQty}" onchange="window._dUpd(${idx},'deliveredQty',this.value)" /></td>
            <td><input class="form-input" value="${r.unitCode||r.unitId||""}" onchange="window._dUpd(${idx},'unitCode',this.value)" /></td>
            <td><select class="form-select" onchange="window._dUpd(${idx},'relatedSalesOrderItemId',this.value)">${options.map((o)=>`<option value="${_escAttr(o.id)}" ${String(o.id)===String(r.relatedSalesOrderItemId)?"selected":""}>${_escHtml(o.text)}</option>`).join("")}</select></td>
            <td>${avail===null?"-":avail}</td>
            <td><button class="btn btn--icon" onclick="window._dDel(${idx})">🗑️</button></td>
          </tr>`;
        }).join("");
      };
      window._dUpd = (idx, key, val) => {
        rows[idx][key] = val;
        if (key === "productId") {
          const p = state.products.find((x) => String(x.id) === String(val));
          if (p) {
            rows[idx].unitId = p.baseUnitId || rows[idx].unitId || "";
            rows[idx].unitCode = p.baseUnitCode || p.baseUnit || rows[idx].unitCode || "";
          }
        }
        renderRows();
      };
      window._dDel=(idx)=>{ rows.splice(idx,1); renderRows(); };
      window._dAdd=()=>{ rows.push({ productId:"", deliveredQty:1, unitId:"", unitCode:"", relatedSalesOrderItemId:"" }); renderRows(); };
      showModal({
        title: editing ? "编辑送货单" : "新建送货单",
        body:`<div class="form-item"><label class="form-label form-label--required">客户</label><select class="form-select" id="doCustomer"><option value="">请选择客户</option>${state.customers.map((c)=>`<option value="${_escAttr(c.id)}" ${editing && String(editing.customerId)===String(c.id) ? "selected" : ""}>${_escHtml(c.name||c.customerName||c.id)}</option>`).join("")}</select><span class="form-error" id="err-doCustomer"></span></div>
          <div class="form-item"><label class="form-label form-label--required">出货日期</label><input class="form-input" type="date" id="doDate" value="${editing ? fmt(editing.deliveryDate) : today}" /><span class="form-error" id="err-doDate"></span></div>
          <div class="form-item"><label class="form-label form-label--required">仓库</label><select class="form-select" id="doWh"><option value="">请选择仓库</option>${warehouseOptions().map((w)=>`<option value="${_escAttr(w.id)}" ${editing && String(editing.warehouseId)===String(w.id) ? "selected" : ""}>${_escHtml(w.name)}</option>`).join("")}</select><span class="form-error" id="err-doWh"></span></div>
          <div class="form-item"><label class="form-label">备注</label><input class="form-input" id="doRemarks" value="${editing ? (editing.remarks || "") : ""}" /></div>
          <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;"><strong>明细行</strong><button class="btn btn--default btn--sm" onclick="window._dAdd()">添加行</button></div>
          <span class="form-error" id="err-doItems"></span>
          <table class="items-table"><thead><tr><th>商品</th><th>出货数量</th><th>单位</th><th>关联销售订单行</th><th>可用库存</th><th>操作</th></tr></thead><tbody id="deliveryItems"></tbody></table>`,
        footer:`<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="window._saveDo()">提交</button>`
      });
      renderRows();
      window._saveDo = async ()=>{
        clearFieldErrors(["doCustomer","doDate","doWh","doItems"]);
        const customerId = document.getElementById("doCustomer").value;
        const deliveryDate = document.getElementById("doDate").value;
        const warehouseId = document.getElementById("doWh").value.trim();
        const hasInvalid = rows.some((r)=>!r.productId);
        if(!customerId) showFieldError("doCustomer","请选择客户");
        if(!deliveryDate) showFieldError("doDate","请选择出货日期");
        if(!warehouseId) showFieldError("doWh","请选择仓库");
        if(!rows.length || hasInvalid) showFieldError("doItems","请至少添加一行完整商品");
        if(!customerId || !deliveryDate || !warehouseId || !rows.length || hasInvalid) return;
        const shortage = rows.filter((r)=>{ const a=getAvail(r.productId); return a!==null && Number(r.deliveredQty||0) > a; });
        const doSubmit = async ()=>{
          const payload = {
            customerId,
            deliveryDate,
            warehouseId,
            remarks: document.getElementById("doRemarks").value.trim(),
            items: rows.map((r, i) => ({
              lineNo: i + 1,
              productId: r.productId,
              deliveredQty: Number(r.deliveredQty || 0),
              unitId: r.unitId,
              relatedSalesOrderItemId: r.relatedSalesOrderItemId || undefined,
            })),
          };
          if(editing){ await request(`/delivery-orders/${editing.id}`,{ method:"PATCH", body: JSON.stringify(payload) }); }
          else { await request("/delivery-orders",{ method:"POST", body: JSON.stringify(payload) }); }
          closeModal(); showToast("success","送货单保存成功"); await Promise.all([loadDelivery(), loadBalances()]);
        };
        if(shortage.length){
          showConfirm("存在库存不足，确认继续提交？", ()=>{ doSubmit().catch((err)=>showToast("error","保存失败："+getErrorMessage(err))); });
          return;
        }
        try{ await doSubmit(); }catch(err){ showToast("error","保存失败："+getErrorMessage(err)); }
      };
    }
    window.openDeliveryModal = openDeliveryModal;

    async function printDelivery(id){
      const order = findById(state.deliveryOrders, id);
      if(!order) return;
      try{
        await request(`/delivery-orders/${id}/print`,{ method:"POST" });
        const items = (order.items || []).map((i) => {
          const p = state.products.find((x) => String(x.id) === String(i.productId));
          const unitText = (p && (p.baseUnitCode || p.baseUnit)) || i.unitCode || i.unitId || "-";
          return `<tr><td>${_escHtml(i.productName || i.productId || "-")}</td><td>${i.deliveredQty || 0}</td><td>${_escHtml(unitText)}</td></tr>`;
        }).join("");
        document.getElementById("printArea").innerHTML = `<div style="padding:24px;"><h2>送货单</h2><div>单号：${_escHtml(order.deliveryNo||order.id)}</div><div>日期：${_escHtml(fmt(order.deliveryDate))}</div><div>客户：${_escHtml(order.customerName||"-")}</div><table class="items-table"><thead><tr><th>商品</th><th>数量</th><th>单位</th></tr></thead><tbody>${items||"<tr><td colspan='3'>无明细</td></tr>"}</tbody></table><div style="margin-top:16px;">发货人签字：___________ 收货人签字：___________</div></div>`;
        document.getElementById("printArea").style.display = "block";
        window.print();
        document.getElementById("printArea").style.display = "none";
        await loadDelivery();
      }catch(err){ showToast("error","打印失败："+getErrorMessage(err)); }
    }
    window.printDelivery = printDelivery;
    async function postDelivery(id){
      showConfirm("确认将该送货单过账？", async ()=>{
        try{
          await request(`/delivery-orders/${id}/post`,{ method:"POST" });
          showToast("success","送货单已过账");
          await Promise.all([loadDelivery(), loadBalances(), loadLedger()]);
        }catch(err){
          const raw = getErrorMessage(err);
          const m = raw.match(/Insufficient inventory for product\s+([0-9a-f-]+)/i);
          if (m && m[1]) {
            const pid = String(m[1]).toLowerCase();
            const product = state.products.find((p)=>String(p.id || "").toLowerCase()===pid);
            const productText = product ? `${product.name || "-"}（${product.productCode || product.id}）` : pid;
            showToast("error",`过账失败：商品 ${productText} 库存不足（当前可用库存可能为 0），请先完成采购入库或减少出货数量后重试`);
            return;
          }
          showToast("error","过账失败："+raw);
        }
      });
    }
    async function voidDelivery(id){
      showConfirm("确认作废该送货单？", async ()=>{
        await runInventoryAction(()=>request(`/delivery-orders/${id}/void`,{ method:"POST" }),"送货单已作废","作废失败",[loadDelivery]);
      });
    }
    window.postDelivery = postDelivery;
    window.voidDelivery = voidDelivery;

    function openWarehouseModal(editId){
      const editing = state.warehouses.find((x)=>String(x.id)===String(editId)) || null;
      showModal({
        title: editing ? "编辑仓库" : "新建仓库",
        body: `<div class="form-item"><label class="form-label form-label--required">仓库编码</label><input class="form-input" id="whCode" value="${editing ? (editing.warehouseCode || "") : ""}" ${editing ? "disabled" : ""} /><span class="form-error" id="err-whCode"></span></div>
          <div class="form-item"><label class="form-label form-label--required">仓库名称</label><input class="form-input" id="whName" value="${editing ? (editing.name || "") : ""}" /><span class="form-error" id="err-whName"></span></div>`,
        footer:`<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="window._saveWh()">提交</button>`
      });
      window._saveWh = async ()=>{
        clearFieldErrors(["whCode","whName"]);
        const warehouseCode = document.getElementById("whCode").value.trim();
        const name = document.getElementById("whName").value.trim();
        if(!editing && !warehouseCode) showFieldError("whCode","请输入仓库编码");
        if(!name) showFieldError("whName","请输入仓库名称");
        if(!editing && warehouseCode && name && warehouseCode.toLowerCase() === name.toLowerCase()){
          showFieldError("whName","仓库名称不能与仓库编码相同");
        }
        if((!editing && !warehouseCode) || !name || (!editing && warehouseCode && name && warehouseCode.toLowerCase() === name.toLowerCase())) return;
        if(!editing){
          const exists = state.warehouses.some((x)=>String(x.warehouseCode || "").toLowerCase()===warehouseCode.toLowerCase());
          if(exists){
            showFieldError("whCode","仓库编码已存在");
            return;
          }
        }
        try{
          if(editing){
            await request(`/warehouses/${editing.id}`,{
              method:"PATCH",
              body: JSON.stringify({ name })
            });
          }else{
            await request("/warehouses",{
              method:"POST",
              body: JSON.stringify({ warehouseCode, name })
            });
          }
          await reloadWarehouseRelated();
          closeModal();
          showToast("success","仓库保存成功");
        }catch(err){
          const msg = getErrorMessage(err, "");
          if(msg.toLowerCase().includes("warehouse code already exists")){
            showFieldError("whCode","仓库编码已存在");
            return;
          }
          showToast("error","仓库保存失败："+getErrorMessage(err));
        }
      };
    }
    window.openWarehouseModal = openWarehouseModal;
    async function removeWarehouse(id){
      const row = state.warehouses.find((x)=>String(x.id)===String(id));
      if(!row){
        showToast("error","仓库不存在");
        return;
      }
      showConfirm("确认删除该仓库？", async ()=>{
        await runInventoryAction(()=>request(`/warehouses/${id}`,{ method:"DELETE" }),"仓库删除成功","仓库删除失败",[loadWarehouses, loadDelivery, loadBalances]);
      });
    }
    window.removeWarehouse = removeWarehouse;

    async function loadPurchase(){ const res = await request("/purchase-receipts?page=1&pageSize=200"); state.purchaseReceipts = listData(res); renderPurchaseList(); }
    async function loadDelivery(){ const res = await request("/delivery-orders?page=1&pageSize=200"); state.deliveryOrders = listData(res); renderDeliveryList(); }
    async function loadWarehouses(){
      const res = await request("/warehouses?page=1&pageSize=200");
      state.warehouses = listData(res);
      renderWarehouseList();
    }
    async function loadBalances(){ const res = await request("/inventory/balances?page=1&pageSize=200"); state.balances = listData(res); renderBalanceList(); }
    async function loadLedger(){ const res = await request("/inventory/ledger?page=1&pageSize=200"); state.ledger = listData(res); renderLedgerList(); }

    function paginate(list,page,size){ const total=list.length; return { total, rows: list.slice((page-1)*size, (page-1)*size+size) }; }
    function resetPurchaseFilter(){ ["purchaseSupplierFilter","purchaseDateFrom","purchaseDateTo"].forEach((id)=>document.getElementById(id).value=""); renderPurchaseList(); }
    window.resetPurchaseFilter = resetPurchaseFilter;
    function resetDeliveryFilter(){ ["deliveryCustomerFilter","deliveryDateFrom","deliveryDateTo"].forEach((id)=>document.getElementById(id).value=""); renderDeliveryList(); }
    window.resetDeliveryFilter = resetDeliveryFilter;
    function resetWarehouseFilter(){ document.getElementById("warehouseKeyword").value=""; renderWarehouseList(); }
    window.resetWarehouseFilter = resetWarehouseFilter;

    function renderPurchaseList(){
      const body = document.getElementById("purchaseBody");
      let list = state.purchaseReceipts;
      list = filterByField(list,"supplierName",document.getElementById("purchaseSupplierFilter").value.trim());
      list = filterByDateRange(list,"receiptDate",document.getElementById("purchaseDateFrom").value,document.getElementById("purchaseDateTo").value);
      const pageData = paginate(list,state.purchasePage,state.pageSize);
      body.innerHTML = pageData.rows.length ? pageData.rows.map((x)=>{
        let ops = "-";
        if (hasPermission("inventory.edit") && String(x.status || "").toUpperCase() === "DRAFT") {
          ops = `<button class="btn btn--icon" title="过账" onclick="postPurchase('${_escAttr(x.id)}')">📥</button><button class="btn btn--icon" title="作废" onclick="voidPurchase('${_escAttr(x.id)}')">🗑️</button>`;
        }
        return `<tr><td>${_escHtml(x.receiptNo||"-")}</td><td>${_escHtml(x.supplierName||"-")}</td><td>${_escHtml(fmt(x.receiptDate))}</td><td>${renderBadge(x.status)}</td><td>${ops}</td></tr>`;
      }).join("") : '<tr><td colspan="5"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
      renderPagination("purchasePagination",pageData.total,state.purchasePage,state.pageSize,(p,s)=>{ state.purchasePage=p; state.pageSize=s; renderPurchaseList(); });
    }
    window.renderPurchaseList = renderPurchaseList;

    async function postPurchase(id){
      showConfirm("确认将该收货单过账？", async ()=>{
        await runInventoryAction(()=>request(`/purchase-receipts/${id}/post`,{ method:"POST" }),"收货单已过账","过账失败",[loadPurchase, loadBalances, loadLedger]);
      });
    }
    async function voidPurchase(id){
      showConfirm("确认作废该收货单？", async ()=>{
        await runInventoryAction(()=>request(`/purchase-receipts/${id}/void`,{ method:"POST" }),"收货单已作废","作废失败",[loadPurchase]);
      });
    }
    window.postPurchase = postPurchase;
    window.voidPurchase = voidPurchase;

    function renderDeliveryList(){
      const body = document.getElementById("deliveryBody");
      let list = state.deliveryOrders;
      list = filterByField(list,"customerName",document.getElementById("deliveryCustomerFilter").value.trim());
      list = filterByDateRange(list,"deliveryDate",document.getElementById("deliveryDateFrom").value,document.getElementById("deliveryDateTo").value);
      const pageData = paginate(list,state.deliveryPage,state.pageSize);
      body.innerHTML = pageData.rows.length ? pageData.rows.map((x)=>{
        const changed = x.modifiedAfterPrint ? '<span class="badge badge--orange" style="margin-left:6px;"><span class="badge__dot"></span>已修改（打印后）</span>' : "";
        const status = String(x.status || "").toUpperCase();
        let ops = "-";
        if (hasPermission("inventory.edit")) {
          if (status === "DRAFT") {
            ops = `<button class="btn btn--icon" title="过账" onclick="event.stopPropagation();postDelivery('${_escAttr(x.id)}')">📤</button><button class="btn btn--icon" title="作废" onclick="event.stopPropagation();voidDelivery('${_escAttr(x.id)}')">🗑️</button><button class="btn btn--icon" title="编辑" onclick="event.stopPropagation();openDeliveryModal('${_escAttr(x.id)}')">✏️</button>`;
          } else if (status === "POSTED" || status === "UPDATED_AFTER_PRINT" || status === "PRINTED") {
            ops = `<button class="btn btn--icon" title="打印" onclick="event.stopPropagation();printDelivery('${_escAttr(x.id)}')">🖨️</button><button class="btn btn--icon" title="作废" onclick="event.stopPropagation();voidDelivery('${_escAttr(x.id)}')">🗑️</button><button class="btn btn--icon" title="编辑" onclick="event.stopPropagation();openDeliveryModal('${_escAttr(x.id)}')">✏️</button>`;
          }
        }
        return `<tr><td>${_escHtml(x.deliveryNo||"-")}</td><td>${_escHtml(x.customerName||"-")}</td><td>${_escHtml(fmt(x.deliveryDate))}</td><td>${renderBadge(x.status)}${changed}</td><td>${ops}</td></tr>`;
      }).join("") : '<tr><td colspan="5"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
      renderPagination("deliveryPagination",pageData.total,state.deliveryPage,state.pageSize,(p,s)=>{ state.deliveryPage=p; state.pageSize=s; renderDeliveryList(); });
    }
    window.renderDeliveryList = renderDeliveryList;

    function renderWarehouseList(){
      const body = document.getElementById("warehouseBody");
      const keyword = document.getElementById("warehouseKeyword").value.trim();
      let list = state.warehouses;
      if(keyword){
        const lower = keyword.toLowerCase();
        list = list.filter((x)=> String(x.name || "").toLowerCase().includes(lower) || String(x.warehouseCode || "").toLowerCase().includes(lower));
      }
      const pageData = paginate(list,state.warehousePage,state.pageSize);
      body.innerHTML = pageData.rows.length ? pageData.rows.map((x)=>{
        const ops = hasPermission("master.edit")
          ? `<button class="btn btn--icon" title="编辑" onclick="event.stopPropagation();openWarehouseModal('${_escAttr(x.id)}')">✏️</button><button class="btn btn--icon" title="删除" onclick="event.stopPropagation();removeWarehouse('${_escAttr(x.id)}')">🗑️</button>`
          : "-";
        return `<tr><td>${_escHtml(x.warehouseCode || "-")}</td><td>${_escHtml(x.name||"-")}</td><td>${ops}</td></tr>`;
      }).join("") : '<tr><td colspan="3"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
      renderPagination("warehousePagination",pageData.total,state.warehousePage,state.pageSize,(p,s)=>{ state.warehousePage=p; state.pageSize=s; renderWarehouseList(); });
    }
    window.renderWarehouseList = renderWarehouseList;

    function renderBalanceList(){
      const body = document.getElementById("balanceBody");
      body.innerHTML = state.balances.length ? state.balances.map((x)=>`<tr><td>${_escHtml(x.warehouseName||x.warehouseId||"-")}</td><td>${_escHtml(x.productName||x.productId||"-")}</td><td>${x.onHandQty||0}</td><td>${x.availableQty||0}</td><td>${_escHtml(x.updatedAt?String(x.updatedAt).replace("T"," ").slice(0,19):"-")}</td></tr>`).join("") : '<tr><td colspan="5"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
    }
    function renderLedgerList(){
      const body = document.getElementById("ledgerBody");
      body.innerHTML = state.ledger.length ? state.ledger.map((x)=>`<tr><td>${_escHtml(x.occurredAt?String(x.occurredAt).replace("T"," ").slice(0,19):"-")}</td><td>${_escHtml(x.bizType||"-")}</td><td>${_escHtml(x.bizNo||"-")}</td><td>${_escHtml(x.productName||x.productId||"-")}</td><td>${x.changeQty||0}</td><td>${x.balanceQty||0}</td></tr>`).join("") : '<tr><td colspan="6"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
    }

    const purchaseImportInput = document.getElementById("purchaseImportFile");
    if (purchaseImportInput) {
      purchaseImportInput.addEventListener("change", onPurchaseImportChange);
    }

    async function initPage(){
      try{
        const [supRes,cusRes,proRes,soRes,convRes,wareRes] = await Promise.all([
          request("/suppliers"),
          request("/customers?page=1&pageSize=200"),
          request("/products"),
          request("/sales-orders?page=1&pageSize=200"),
          request("/unit-conversions?page=1&pageSize=200"),
          request("/warehouses?page=1&pageSize=200")
        ]);
        state.suppliers = listData(supRes);
        state.customers = listData(cusRes);
        state.products = listData(proRes);
        state.salesOrders = listData(soRes);
        state.conversions = listData(convRes);
        state.warehouses = listData(wareRes);
        renderWarehouseList();
        await Promise.all([loadPurchase(), loadDelivery(), loadBalances(), loadLedger()]);
        applyPermissionUi(document);
      }catch(err){ showToast("error","库存页面加载失败："+getErrorMessage(err)); }
    }
    initPage();

