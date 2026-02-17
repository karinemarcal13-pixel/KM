const PIX_KEY = '12204316997';
const MONTHLY_FEE = 20.00;
const STORAGE_KEY = 'agenda_appointments_v1';
const PIX_RECEIVER = 'KM SCHEDULE';
const PIX_CITY = 'PARANÁ';

function $(selector) { return document.querySelector(selector); }

function loadAppointments() {
	const raw = localStorage.getItem(STORAGE_KEY);
	return raw ? JSON.parse(raw) : [];
}

function saveAppointments(list) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function formatDate(d) {
	return d;
}

function normalizePhone(phone) {
	const digits = phone.replace(/\D/g, '');
	if (digits.startsWith('55')) return digits;
	// assume Brazil if length is 10 or 11
	if (digits.length === 10 || digits.length === 11) return '55' + digits;
	return digits; // as-is
}

function buildWhatsAppUrl(phone, message) {
	const p = normalizePhone(phone);
	return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

function renderAppointments() {
	const list = loadAppointments();
	const el = $('#appointmentsList');
	el.innerHTML = '';
	if (list.length === 0) {
		el.innerHTML = '<li class="empty">Nenhum agendamento</li>';
		return;
	}

	list.forEach(item => {
		const li = document.createElement('li');
		li.className = 'appointment';
		li.innerHTML = `
			<div class="meta">
				<strong>${item.name}</strong>
				<span class="date">${item.date} ${item.time}</span>
			</div>
			<div class="details">
				<div>Procedimento: ${item.procedure || '-'} </div>
				<div>Pagamento: ${item.paymentMethod} ${item.paid ? '(Pago)' : '(Pendente)'} </div>
			</div>
			<div class="actions">
				<button class="btn confirm" data-id="${item.id}">Reenviar WhatsApp</button>
				<button class="btn mark" data-id="${item.id}">${item.paid ? 'Desmarcar pago' : 'Marcar como pago'}</button>
				<button class="btn qr" data-id="${item.id}">Gerar QR Pix</button>
				<button class="btn remove" data-id="${item.id}">Excluir</button>
			</div>
		`;

		el.appendChild(li);
	});

	// attach handlers
	document.querySelectorAll('.btn.confirm').forEach(b => b.addEventListener('click', e => {
		const id = e.currentTarget.dataset.id;
		const item = loadAppointments().find(a => String(a.id) === id);
		if (item) sendConfirmation(item);
	}));

	document.querySelectorAll('.btn.mark').forEach(b => b.addEventListener('click', e => {
		const id = e.currentTarget.dataset.id;
		const list = loadAppointments();
		const idx = list.findIndex(a => String(a.id) === id);
		if (idx >= 0) {
			list[idx].paid = !list[idx].paid;
			saveAppointments(list);
			renderAppointments();
			// gerar recibo PDF quando marcado como pago
			if (list[idx].paid) {
				generateReceiptPdf(list[idx]);
			}
		}
	}));

	document.querySelectorAll('.btn.remove').forEach(b => b.addEventListener('click', e => {
		const id = e.currentTarget.dataset.id;
		let list = loadAppointments();
		list = list.filter(a => String(a.id) !== id);
		saveAppointments(list);
		renderAppointments();
	}));

	document.querySelectorAll('.btn.qr').forEach(b => b.addEventListener('click', e => {
		const id = e.currentTarget.dataset.id;
		const item = loadAppointments().find(a => String(a.id) === id);
		if (item) generatePixQrForAppointment(item);
	}));
}

function buildField(id, value){
	const v = String(value);
	const len = v.length.toString().padStart(2,'0');
	return id + len + v;
}

function calculateCRC(payload) {
	// CRC16-CCITT (XModem) implementation
	const data = new TextEncoder().encode(payload);
	let crc = 0xFFFF;
	for (let i=0;i<data.length;i++){
		crc ^= (data[i] << 8);
		for (let j=0;j<8;j++){
			if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
			else crc <<= 1;
			crc &= 0xFFFF;
		}
	}
	return crc.toString(16).toUpperCase().padStart(4,'0');
}

function buildBRCode({pixKey, amount, merchantName, merchantCity, txid}){
	const gui = buildField('00','BR.GOV.BCB.PIX');
	const keyField = buildField('01', pixKey);
	const txField = txid ? buildField('05', txid) : '';
	const mai = '26' + String((gui + keyField + txField).length).padStart(2,'0') + gui + keyField + txField;

	const payload =
		buildField('00','01') +
		mai +
		buildField('52','0000') +
		buildField('53','986') +
		buildField('54', String(Number(amount).toFixed(2))) +
		buildField('58','BR') +
		buildField('59', merchantName.substring(0,25)) +
		buildField('60', merchantCity.substring(0,15)) +
		'62' + buildField('05','') // empty additional data template (no txid here)
		;

	const payloadForCrc = payload + '6304';
	const crc = calculateCRC(payloadForCrc);
	return payload + '63' + '04' + crc;
}

function generateQRCodeIn(el, text){
	el.innerHTML = '';
	new QRCode(el, {text, width:220, height:220});
}

function getQrDataUrl(container){
	if(!container) return null;
	const img = container.querySelector('img');
	if(img && img.src && img.src.startsWith('data:')) return img.src;
	const canvas = container.querySelector('canvas');
	if(canvas) return canvas.toDataURL('image/png');
	return null;
}

function triggerDownloadDataUrl(dataUrl, filename){
	const a = document.createElement('a');
	a.href = dataUrl;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

function generatePixQrForAppointment(item){
	const container = document.getElementById('pixQr');
	const txid = String(item.id);
	const brcode = buildBRCode({pixKey: PIX_KEY, amount: MONTHLY_FEE, merchantName: PIX_RECEIVER, merchantCity: PIX_CITY, txid});
	generateQRCodeIn(container, brcode);
	// show short instructions
	container.insertAdjacentHTML('beforeend', `<p class="muted">QR para ${item.name} — TXID: ${txid}</p>`);
	// show download button for this QR
	const dl = document.getElementById('downloadPixQr');
	const dataUrl = getQrDataUrl(container);
	if (dl && dataUrl) { dl.style.display = 'inline-block'; dl.onclick = () => triggerDownloadDataUrl(dataUrl, `pix_${txid}.png`); }
}

function generateReceiptPdf(item){
	try{
		const { jsPDF } = window.jspdf;
		const doc = new jsPDF();
		// Header / logo placeholder (simple colored block + text)
		doc.setFillColor(11,122,95);
		doc.rect(14, 10, 40, 12, 'F');
		doc.setTextColor(255,255,255);
		doc.setFontSize(10);
		doc.text('KM SCHEDULE', 16, 18);
		doc.setTextColor(0,0,0);
		const title = 'Recibo de Pagamento';
		doc.setFontSize(14);
		doc.text(title, 14, 34);

		doc.setFontSize(12);
		const lines = [];
		lines.push(`Recebedor: ${PIX_RECEIVER}`);
		lines.push(`Cidade: ${PIX_CITY}`);
		lines.push(`Pix (chave): ${PIX_KEY}`);
		lines.push(`Valor: R$ ${Number(MONTHLY_FEE).toFixed(2)}`);
		lines.push('');
		lines.push(`Cliente: ${item.name}`);
		lines.push(`Telefone: ${item.phone}`);
		lines.push(`Procedimento: ${item.procedure || '-'}`);
		lines.push(`Data/Hora: ${item.date} ${item.time}`);
		lines.push(`Forma de pagamento: ${item.paymentMethod}`);
		lines.push(`TXID: ${item.id}`);
		lines.push('');
		lines.push('Status: Pago');
		lines.push('');
		lines.push('Obrigado pelo pagamento.');

		let y = 30;
		lines.forEach(line => {
			const split = doc.splitTextToSize(line, 180);
			doc.text(split, 14, y);
			y += (split.length * 7);
		});

		const filename = `recibo_${item.id}.pdf`;
		doc.save(filename);
	}catch(err){
		console.error('Erro ao gerar PDF', err);
		alert('Não foi possível gerar o recibo em PDF neste navegador.');
	}
}

document.addEventListener('DOMContentLoaded', () => {
	// existing DOMContentLoaded handler continues; ensure generate button binds
	const gen = document.getElementById('generatePixQr');
	if (gen) gen.addEventListener('click', () => {
		const container = document.getElementById('pixQr');
		const brcode = buildBRCode({pixKey: PIX_KEY, amount: MONTHLY_FEE, merchantName: PIX_RECEIVER, merchantCity: PIX_CITY, txid: ''});
		generateQRCodeIn(container, brcode);
		container.insertAdjacentHTML('beforeend', `<p class="muted">Pix estático para mensalidade R$${MONTHLY_FEE.toFixed(2)}</p>`);
		// show download button
		const dl = document.getElementById('downloadPixQr');
		const dataUrl = getQrDataUrl(container);
		if (dl && dataUrl) { dl.style.display = 'inline-block'; dl.onclick = () => triggerDownloadDataUrl(dataUrl, `pix_${Date.now()}.png`); }
	});
	// bind download button in case QR generated via appointment
	const dlBtn = document.getElementById('downloadPixQr');
	if (dlBtn) dlBtn.addEventListener('click', ()=>{
		const container = document.getElementById('pixQr');
		const dataUrl = getQrDataUrl(container);
		if (dataUrl) triggerDownloadDataUrl(dataUrl, `pix_${Date.now()}.png`);
		else alert('Nenhum QR disponível para download. Primeiro gere o QR.');
	});
});

function sendConfirmation(item) {
	const message = `Olá ${item.name}, seu agendamento foi recebido.\n` +
		`Procedimento: ${item.procedure || '-'}\n` +
		`Data: ${item.date} às ${item.time}\n` +
		`Valor da mensalidade: R$ ${MONTHLY_FEE.toFixed(2)}\n` +
		(item.paymentMethod === 'pix' ? `Pagar via Pix (chave: ${PIX_KEY}).\n` : `Forma de pagamento: ${item.paymentMethod}.\n`) +
		`Depois, envie o comprovante por aqui. Para suporte: karinemarcal13@gmail.com`;

	const url = buildWhatsAppUrl(item.phone, message);
	window.open(url, '_blank');
}

document.addEventListener('DOMContentLoaded', () => {
	renderAppointments();

	$('#bookingForm').addEventListener('submit', e => {
		e.preventDefault();
		const name = $('#name').value.trim();
		const phone = $('#phone').value.trim();
		const date = $('#date').value;
		const time = $('#time').value;
		const procedure = $('#procedure').value.trim();
		const paymentMethod = $('#paymentMethod').value;

		if (!name || !phone || !date || !time) {
			alert('Preencha nome, telefone, data e hora.');
			return;
		}

		const appointment = {
			id: Date.now(),
			name, phone, date, time, procedure, paymentMethod, paid: false
		};

		const list = loadAppointments();
		list.push(appointment);
		saveAppointments(list);
		renderAppointments();

		// enviar confirmação via WhatsApp (abre em nova aba)
		sendConfirmation(appointment);

		// opcional: limpar formulario
		$('#bookingForm').reset();
	});
});

