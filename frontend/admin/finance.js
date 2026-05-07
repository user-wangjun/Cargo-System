initTheme(); initSidebar(); initNavbar(); initMobileDrawer();
    const state = { invoices:[], requests:[], receipts:[], deliveryOrders:[], customers:[], invoicePage:1, requestPage:1, receiptPage:1, pageSize:10 };
    function listData(res){ return res?.data?.list || res?.data || []; }
    function fmt(d){ return d ? String(d).slice(0,10) : "-"; }
    function switchTab(tab){ ["invoices","requests","receipts"].forEach((x)=>{ document.getElementById("tab-"+x).classList.toggle("active",x===tab); document.getElementById("tab-"+x+"-btn").classList.toggle("active",x===tab); }); }
    window.switchTab = switchTab;

    function paginate(list,page,size){ const total=list.length; return { total, rows: list.slice((page-1)*size, (page-1)*size+size) }; }
    function findById(list, id){ return list.find((x)=>String(x.id)===String(id)); }
    function eligibleDeliveryOrders(){ return state.deliveryOrders.filter((d)=>{ const status = String(d.status || "").toUpperCase(); return status === "POSTED" || status === "PRINTED"; }); }
    function issuedInvoices(customerId){
      return state.invoices.filter((i)=> String(i.status || "").toUpperCase() === "ISSUED" && (!customerId || String(i.customerId) === String(customerId)));
    }
    function renderIssuedInvoiceOptions(customerId, selectedInvoiceId = ""){
      return `<option value="">请选择已开具发票</option>${issuedInvoices(customerId).map((i)=>`<option value="${_escAttr(i.id)}" ${String(i.id)===String(selectedInvoiceId) ? "selected" : ""}>${_escHtml(i.invoiceNo||i.id)} / ${_escHtml(i.customerName||"-")} / ${i.totalAmount||0}</option>`).join("")}`;
    }
    async function runFinanceAction(action, successMessage, failurePrefix){
      try{
        await action();
        if(successMessage) showToast("success", successMessage);
        await loadAll();
      }catch(err){
        showToast("error", `${failurePrefix}：${getErrorMessage(err)}`);
      }
    }

    async function loadAll(){
      try{
        const [cRes,dRes,iRes,pRes,rRes] = await Promise.all([
          request("/customers?page=1&pageSize=200"),
          request("/delivery-orders?page=1&pageSize=200"),
          request("/invoices?page=1&pageSize=200"),
          request("/payment-requests?page=1&pageSize=200"),
          request("/receipts?page=1&pageSize=200")
        ]);
        state.customers = listData(cRes);
        state.deliveryOrders = listData(dRes);
        state.invoices = listData(iRes);
        state.requests = listData(pRes);
        state.receipts = listData(rRes);
        renderInvoices(); renderRequests(); renderReceipts();
        applyPermissionUi(document);
      }catch(err){ showToast("error","财务页面加载失败："+getErrorMessage(err)); }
    }

    function renderInvoices(){
      const body = document.getElementById("invoiceBody");
      let list = state.invoices;
      list = filterByField(list,"invoiceNo",document.getElementById("invoiceNoFilter").value.trim());
      list = filterByField(list,"customerName",document.getElementById("invoiceCustomerFilter").value.trim());
      list = filterByField(list,"status",document.getElementById("invoiceStatusFilter").value);
      const pageData = paginate(list,state.invoicePage,state.pageSize);
      body.innerHTML = pageData.rows.length ? pageData.rows.map((x)=>{
        const ops = hasPermission("finance.edit")
          ? `${x.status==="DRAFT" ? `<button class="btn btn--icon" title="开具" onclick="issueInvoice('${_escAttr(x.id)}')">✅</button><button class="btn btn--icon" title="作废" onclick="voidInvoice('${_escAttr(x.id)}')">🗑️</button>` : ""}${x.status==="ISSUED" ? `<button class="btn btn--icon" title="作废" onclick="voidInvoice('${_escAttr(x.id)}')">🗑️</button>` : ""}` || "-"
          : "-";
        return `<tr><td>${_escHtml(x.invoiceNo||"-")}</td><td>${_escHtml(x.customerName||"-")}</td><td>${_escHtml(x.deliveryNo||x.deliveryOrderId||"-")}</td><td>${_escHtml(fmt(x.invoiceDate))}</td><td>${x.totalAmount||0}</td><td>${renderBadge(x.status)}</td><td>${ops}</td></tr>`;
      }).join("") : '<tr><td colspan="7"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
      renderPagination("invoicePagination",pageData.total,state.invoicePage,state.pageSize,(p,s)=>{ state.invoicePage=p; state.pageSize=s; renderInvoices(); });
    }
    window.renderInvoices = renderInvoices;
    function resetInvoiceFilter(){ ["invoiceNoFilter","invoiceCustomerFilter"].forEach((id)=>document.getElementById(id).value=""); document.getElementById("invoiceStatusFilter").value=""; renderInvoices(); }
    window.resetInvoiceFilter = resetInvoiceFilter;

    function renderRequests(){
      const body = document.getElementById("requestBody");
      let list = state.requests;
      list = filterByField(list,"requestNo",document.getElementById("requestNoFilter").value.trim());
      list = filterByField(list,"status",document.getElementById("requestStatusFilter").value);
      const pageData = paginate(list,state.requestPage,state.pageSize);
      body.innerHTML = pageData.rows.length ? pageData.rows.map((x)=>{
        let ops = "-";
        if (x.status === "DRAFT" && hasPermission("finance.edit")) {
          ops = `<button class="btn btn--icon" title="提交" onclick="submitRequest('${_escAttr(x.id)}')">📤</button>`;
        } else if (x.status === "SUBMITTED" && hasPermission("finance.approve")) {
          ops = `<button class="btn btn--icon" title="审批" onclick="approveRequest('${_escAttr(x.id)}')">✅</button><button class="btn btn--icon" title="拒绝" onclick="rejectRequest('${_escAttr(x.id)}')">❌</button>`;
        } else if ((x.status === "APPROVED" || x.status === "REJECTED") && hasPermission("finance.approve")) {
          ops = `<button class="btn btn--icon" title="关闭" onclick="closeRequest('${_escAttr(x.id)}')">🔒</button>`;
        }
        return `<tr><td>${_escHtml(x.requestNo||"-")}</td><td>${_escHtml(x.invoiceNo||x.invoiceId||"-")}</td><td>${_escHtml(x.customerName||"-")}</td><td>${x.requestedAmount||0}</td><td>${_escHtml(fmt(x.requestDate))}</td><td>${renderBadge(x.status)}</td><td>${ops}</td></tr>`;
      }).join("") : '<tr><td colspan="7"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
      renderPagination("requestPagination",pageData.total,state.requestPage,state.pageSize,(p,s)=>{ state.requestPage=p; state.pageSize=s; renderRequests(); });
    }
    window.renderRequests = renderRequests;
    function resetRequestFilter(){ document.getElementById("requestNoFilter").value=""; document.getElementById("requestStatusFilter").value=""; renderRequests(); }
    window.resetRequestFilter = resetRequestFilter;

    function renderReceipts(){
      const body = document.getElementById("receiptBody");
      let list = state.receipts;
      list = filterByField(list,"receiptNo",document.getElementById("receiptNoFilter").value.trim());
      const pageData = paginate(list,state.receiptPage,state.pageSize);
      body.innerHTML = pageData.rows.length ? pageData.rows.map((x)=>`<tr><td>${_escHtml(x.receiptNo||"-")}</td><td>${_escHtml(x.invoiceNo||x.invoiceId||"-")}</td><td>${_escHtml(x.customerName||"-")}</td><td>${x.amount||0}</td><td>${_escHtml(fmt(x.receivedDate))}</td></tr>`).join("") : '<tr><td colspan="5"><div class="empty-state"><span class="empty-state__text">暂无数据</span></div></td></tr>';
      renderPagination("receiptPagination",pageData.total,state.receiptPage,state.pageSize,(p,s)=>{ state.receiptPage=p; state.pageSize=s; renderReceipts(); });
    }
    window.renderReceipts = renderReceipts;
    function resetReceiptFilter(){ document.getElementById("receiptNoFilter").value=""; renderReceipts(); }
    window.resetReceiptFilter = resetReceiptFilter;

    function openCreateInvoiceModal(){
      const deliveryList = eligibleDeliveryOrders();
      showModal({
        title:"生成发票",
        body:`<div class="form-item"><label class="form-label form-label--required">选择送货单</label><select class="form-select" id="newInvoiceDelivery" onchange="window._fillInvoiceAmount()"><option value="">请选择送货单</option>${deliveryList.map((d)=>`<option value="${_escAttr(d.id)}">${_escHtml(d.deliveryNo||d.id)} / ${_escHtml(d.customerName||"-")} / ${_escHtml(d.status||"-")}</option>`).join("")}</select><span class="form-error" id="err-newInvoiceDelivery"></span></div>
          <div class="form-item"><label class="form-label form-label--required">发票金额</label><input class="form-input" id="newInvoiceAmount" type="number" min="0.01" step="0.01" placeholder="请输入发票金额"><span class="form-error" id="err-newInvoiceAmount"></span></div>`,
        footer:`<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="saveInvoice()">生成</button>`
      });
      window._fillInvoiceAmount = ()=>{
        const deliveryOrderId = document.getElementById("newInvoiceDelivery").value;
        const delivery = findById(deliveryList, deliveryOrderId);
        const input = document.getElementById("newInvoiceAmount");
        if(!delivery || !input || String(input.value || "").trim()) return;
        const amount = Number(delivery.totalAmount ?? delivery.amount ?? 0);
        if(Number.isFinite(amount) && amount > 0){
          input.value = String(amount);
        }
      };
    }
    window.openCreateInvoiceModal = openCreateInvoiceModal;
    async function saveInvoice(){
      clearFieldErrors(["newInvoiceDelivery","newInvoiceAmount"]);
      const deliveryOrderId = document.getElementById("newInvoiceDelivery").value;
      const totalAmount = Number(document.getElementById("newInvoiceAmount").value || 0);
      if(!deliveryOrderId){ showFieldError("newInvoiceDelivery","请选择送货单"); return; }
      if(!(totalAmount > 0)){ showFieldError("newInvoiceAmount","请输入大于 0 的发票金额"); return; }
      const delivery = findById(state.deliveryOrders, deliveryOrderId);
      if(!delivery || !delivery.customerId){ showToast("error","送货单缺少客户信息，无法生成发票"); return; }
      const payload = {
        customerId: String(delivery.customerId),
        deliveryOrderId,
        invoiceDate: getLocalDateInputValue(),
        totalAmount
      };
      try{
        await request("/invoices",{ method:"POST", body: JSON.stringify(payload) });
        closeModal();
        showToast("success","发票生成成功");
        await loadAll();
      }catch(err){
        if(err?.status === 400 || err?.status === 404) showToast("error","关联送货单无效");
        else showToast("error","发票生成失败："+getErrorMessage(err));
      }
    }
    window.saveInvoice = saveInvoice;

    function openCreateRequestModal(){
      showModal({
        title:"新建请款单",
        body:`<div class="form-item"><label class="form-label form-label--required">客户</label><select class="form-select" id="newReqCustomer" onchange="window._fillReqInvoices()"><option value="">请选择客户</option>${state.customers.map((c)=>`<option value="${_escAttr(c.id)}">${_escHtml(c.name||c.customerName||c.id)}</option>`).join("")}</select><span class="form-error" id="err-newReqCustomer"></span></div>
          <div class="form-item"><label class="form-label form-label--required">发票</label><select class="form-select" id="newReqInvoice" onchange="window._syncReqCustomerByInvoice()"></select><span class="form-error" id="err-newReqInvoice"></span></div>
          <div class="form-item"><label class="form-label form-label--required">请款日期</label><input class="form-input" id="newReqDate" type="date" value="${getLocalDateInputValue()}"><span class="form-error" id="err-newReqDate"></span></div>
          <div class="form-item"><label class="form-label form-label--required">请款金额</label><input class="form-input" id="newReqAmount" type="number" min="0" step="0.01"><span class="form-error" id="err-newReqAmount"></span></div>`,
        footer:`<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="saveRequest()">提交</button>`
      });
      window._fillReqInvoices = ()=>{
        const cid = document.getElementById("newReqCustomer").value;
        document.getElementById("newReqInvoice").innerHTML = renderIssuedInvoiceOptions(cid, document.getElementById("newReqInvoice").value);
      };
      window._syncReqCustomerByInvoice = ()=>{
        const invoiceId = document.getElementById("newReqInvoice").value;
        const inv = findById(state.invoices, invoiceId);
        if(inv && inv.customerId){
          document.getElementById("newReqCustomer").value = String(inv.customerId);
          document.getElementById("newReqInvoice").innerHTML = renderIssuedInvoiceOptions(inv.customerId, invoiceId);
        }
      };
      window._fillReqInvoices();
    }
    window.openCreateRequestModal = openCreateRequestModal;
    async function saveRequest(){
      clearFieldErrors(["newReqCustomer","newReqInvoice","newReqDate","newReqAmount"]);
      const invoiceId = document.getElementById("newReqInvoice").value;
      const invoice = findById(state.invoices, invoiceId);
      const customerId = document.getElementById("newReqCustomer").value || String(invoice?.customerId || "");
      const requestDate = document.getElementById("newReqDate").value;
      const requestedAmount = Number(document.getElementById("newReqAmount").value || 0);
      if(!customerId) showFieldError("newReqCustomer","请选择客户");
      if(!invoiceId) showFieldError("newReqInvoice","请选择发票");
      if(!requestDate) showFieldError("newReqDate","请选择日期");
      if(!(requestedAmount > 0)) showFieldError("newReqAmount","请输入大于 0 的金额");
      if(!customerId || !invoiceId || !requestDate || !(requestedAmount > 0)) return;
      try{
        await request("/payment-requests",{ method:"POST", body: JSON.stringify({ customerId, invoiceId, requestDate, requestedAmount }) });
        closeModal();
        showToast("success","请款单创建成功");
        await loadAll();
      }catch(err){
        showToast("error","请款单创建失败："+getErrorMessage(err));
      }
    }
    window.saveRequest = saveRequest;

    function openCreateReceiptModal(){
      const invoiceList = issuedInvoices();
      showModal({
        title:"新建回款",
        body:`<div class="form-item"><label class="form-label form-label--required">发票</label><select class="form-select" id="newReceiptInvoice"><option value="">请选择已开具发票</option>${invoiceList.map((i)=>`<option value="${_escAttr(i.id)}">${_escHtml(i.invoiceNo||i.id)} / ${_escHtml(i.customerName||"-")}</option>`).join("")}</select><span class="form-error" id="err-newReceiptInvoice"></span></div>
          <div class="form-item"><label class="form-label form-label--required">回款金额</label><input class="form-input" id="newReceiptAmount" type="number" min="0" step="0.01"><span class="form-error" id="err-newReceiptAmount"></span></div>
          <div class="form-item"><label class="form-label form-label--required">回款日期</label><input class="form-input" id="newReceiptDate" type="date" value="${getLocalDateInputValue()}"><span class="form-error" id="err-newReceiptDate"></span></div>`,
        footer:`<button class="btn btn--ghost btn--sm" onclick="closeModal()">取消</button><button class="btn btn--primary btn--sm" onclick="saveReceipt()">提交</button>`
      });
    }
    window.openCreateReceiptModal = openCreateReceiptModal;
    async function saveReceipt(){
      clearFieldErrors(["newReceiptInvoice","newReceiptAmount","newReceiptDate"]);
      const invoiceId = document.getElementById("newReceiptInvoice").value;
      const invoice = findById(state.invoices, invoiceId);
      const customerId = String(invoice?.customerId || "");
      const amount = Number(document.getElementById("newReceiptAmount").value || 0);
      const receivedDate = document.getElementById("newReceiptDate").value;
      if(!invoiceId) showFieldError("newReceiptInvoice","请选择发票");
      if(!(amount > 0)) showFieldError("newReceiptAmount","请输入大于 0 的金额");
      if(!receivedDate) showFieldError("newReceiptDate","请选择日期");
      if(!customerId) showToast("error","所选发票缺少客户信息");
      if(!invoiceId || !customerId || !(amount > 0) || !receivedDate) return;
      try{
        await request("/receipts",{ method:"POST", body: JSON.stringify({ customerId, invoiceId, amount, receivedDate }) });
        closeModal();
        showToast("success","回款创建成功");
        await loadAll();
      }catch(err){
        showToast("error","回款创建失败："+getErrorMessage(err));
      }
    }
    window.saveReceipt = saveReceipt;

    async function submitRequest(id){ await runFinanceAction(()=>request(`/payment-requests/${id}/submit`,{ method:"POST" }),"请款单已提交","提交失败"); }
    async function approveRequest(id){ await runFinanceAction(()=>request(`/payment-requests/${id}/approve`,{ method:"POST" }),"请款单已审批","审批失败"); }
    async function rejectRequest(id){ await runFinanceAction(()=>request(`/payment-requests/${id}/reject`,{ method:"POST" }),"请款单已拒绝","拒绝失败"); }
    async function closeRequest(id){ await runFinanceAction(()=>request(`/payment-requests/${id}/close`,{ method:"POST" }),"请款单已关闭","关闭失败"); }
    async function issueInvoice(id){ await runFinanceAction(()=>request(`/invoices/${id}/issue`,{ method:"POST" }),"发票已开具","开具失败"); }
    async function voidInvoice(id){ showConfirm("确认作废该发票？", async ()=>{ await runFinanceAction(()=>request(`/invoices/${id}/void`,{ method:"POST" }),"发票已作废","作废失败"); }); }
    window.submitRequest = submitRequest; window.approveRequest = approveRequest; window.rejectRequest = rejectRequest; window.closeRequest = closeRequest; window.issueInvoice = issueInvoice; window.voidInvoice = voidInvoice;

    loadAll();

