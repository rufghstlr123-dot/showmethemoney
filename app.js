// Firebase Library Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, get, child, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Configuration (본인의 설정값으로 교체 필요)
const firebaseConfig = {
    apiKey: "AIzaSyDidXRsVsNdx66hLDNtDwYBANMe8PGffO0",
    authDomain: "showmethemoney-19bb3.firebaseapp.com",
    databaseURL: "https://showmethemoney-19bb3-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "showmethemoney-19bb3",
    storageBucket: "showmethemoney-19bb3.appspot.com",
    messagingSenderId: "857875206271",
    appId: "1:857875206271:web:589d3e2b61e75abfa82f4a"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// State management
let state = {
    currentDate: new Date(),
    viewMode: 'daily',
    userMode: 'guest', // default to guest
    author: '',
    isLocked: false,
    pisAmount: null,
    giftOpenCount: { 5000: null, 10000: null, 50000: null },
    giftOutCount: { 5000: null, 10000: null, 50000: null },
    giftCloseCount: { 5000: null, 10000: null, 50000: null },
    cashCount: { 50000: null, 10000: null, 5000: null, 1000: null, 500: null, 100: null, 50: null, 10: null }
};

let currentListener = null; // Unsubscribe function for real-time updates

// DOM Elements
const elements = {
    displayDate: document.getElementById('current-date-display'),
    btnPrevDay: document.getElementById('btn-prev-day'),
    btnNextDay: document.getElementById('btn-next-day'),
    giftOpenInputs: document.querySelectorAll('.gift-input-open'),
    giftOutInputs: document.querySelectorAll('.gift-input-out'),
    giftCloseInputs: document.querySelectorAll('.gift-input-close'),
    cashInputs: document.querySelectorAll('.cash-input'),
    displayPrevBalance: document.getElementById('display-prev-balance'),
    displayBookBalance: document.getElementById('display-book-balance'),
    displayGiftOpenTotal: document.getElementById('display-gift-open-total'),
    displayGiftCloseTotal: document.getElementById('display-gift-close-total'),
    displayCashTotal: document.getElementById('display-cash-total'),
    finalBook: document.getElementById('final-book-balance'),
    displayGiftOpenTotal: document.getElementById('display-gift-open-total'),
    displayGiftOutTotal: document.getElementById('display-gift-out-total'),
    displayGiftCloseTotal: document.getElementById('display-gift-close-total'),
    finalPhysical: document.getElementById('final-physical-balance'),
    finalDiscrepancy: document.getElementById('final-discrepancy'),
    totalDiff: document.getElementById('total-difference'),
    diffContainer: document.getElementById('final-diff-container'),
    calendarTrigger: document.getElementById('calendar-trigger'),
    calendarModal: document.getElementById('calendar-modal'),
    calendarOverlay: document.getElementById('calendar-overlay'),
    calendarDays: document.getElementById('calendar-days'),
    calMonthYear: document.getElementById('cal-month-year'),
    calBtnPrev: document.getElementById('cal-prev-month'),
    calBtnNext: document.getElementById('cal-next-month'),
    btnSaveAll: document.getElementById('btn-save-all'),
    navDaily: document.getElementById('nav-daily'),
    navMonthly: document.getElementById('nav-monthly'),
    navWeekly: document.getElementById('nav-weekly'),
    mainContent: document.getElementById('main-content-area'),
    inputAuthor: document.getElementById('input-author'),
    guestHeader: document.getElementById('guest-header'),
    adminHeader: document.getElementById('admin-header'),
    btnAdminLogin: document.getElementById('btn-admin-login'),
    btnAdminLogout: document.getElementById('btn-admin-logout'),
    monthlyDiscrepancyPanel: document.getElementById('monthly-discrepancy-panel'),
    monthlyDiscrepancyList: document.getElementById('monthly-discrepancy-list'),
    navHistory: document.getElementById('nav-history'),
    historyList: document.getElementById('history-tab-list'),
    historyViewArea: document.getElementById('history-view'),
    imageModal: document.getElementById('image-modal'),
    imageOverlay: document.getElementById('image-overlay'),
    btnCloseImage: document.getElementById('btn-close-image'),
    previewImg: document.getElementById('history-preview-img'),
    btnImageRestore: document.getElementById('btn-image-restore'),
};

// Helpers for Number Formatting
function parseNumber(str) {
    if (!str) return 0;
    return Number(str.toString().replace(/[^0-9]/g, '')) || 0;
}

function formatNumber(n) {
    if (n === null || n === undefined || isNaN(n) || n === "") return "";
    return new Intl.NumberFormat('ko-KR').format(n);
}

function formatCurrency(number) {
    return new Intl.NumberFormat('ko-KR').format(number) + '원';
}

// Local Calendar View State
let calViewDate = new Date();

function getMonthWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0(Sun) to 6(Sat)
    // Standard Monday of this week
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Bounds of this month
    const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    let start = new Date(monday);
    if (start < firstOfMonth) start = firstOfMonth;

    let end = new Date(sunday);
    if (end > lastOfMonth) end = lastOfMonth;

    return { start, end };
}

// Initial Render
function init() {
    loadData();
    renderDate();
    calculateTotals();
    setupEventListeners();
} function getDatePath(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `closing_v2/daily/${y}-${m}-${d}`;
}

function getHistoryPath(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const timestamp = new Date().getTime();
    return `closing_v2/history/${y}-${m}-${d}/${timestamp}`;
}

async function saveData(doLock = false) {
    if (state.viewMode !== 'daily') return;
    
    // If the data is being loaded by the listener, don't trigger a save loop
    if (state.isLocked && !doLock && state.userMode !== 'admin') return;

    if (doLock) state.isLocked = true;
    
    // Update local state arrays before potential screenshot
    elements.giftOpenInputs.forEach(input => {
        state.giftOpenCount[input.getAttribute('data-value')] = input.value === '' ? null : parseNumber(input.value);
    });
    elements.giftOutInputs.forEach(input => {
        state.giftOutCount[input.getAttribute('data-value')] = input.value === '' ? null : parseNumber(input.value);
    });
    elements.giftCloseInputs.forEach(input => {
        state.giftCloseCount[input.getAttribute('data-value')] = input.value === '' ? null : parseNumber(input.value);
    });
    elements.cashInputs.forEach(input => {
        state.cashCount[input.getAttribute('data-value')] = input.value === '' ? null : parseNumber(input.value);
    });
    state.pisAmount = elements.finalBook.value === '' ? null : parseNumber(elements.finalBook.value);
    state.author = elements.inputAuthor ? elements.inputAuthor.value : '';

    let screenshot = null;
    if (doLock) {
        // Apply "Locked" visuals (red/orange backgrounds) before taking screenshot
        updateUIOnly(); 
        
        try {
            // Briefly wait for browsers to complete rendering the style change
            await new Promise(r => setTimeout(r, 300));
            
            const canvas = await html2canvas(elements.mainContent, {
                scale: 2, // 2x resolution is plenty for PNG
                logging: false,
                useCORS: true,
                backgroundColor: '#f8fafc',
                onclone: (clonedDoc) => {
                    const clonedMain = clonedDoc.getElementById('main-content-area');
                    if (clonedMain) {
                        clonedMain.style.width = '1400px';
                        clonedMain.style.padding = '40px';
                        clonedMain.style.backgroundColor = '#f8fafc';
                    }
                }
            });
            // Switch to PNG for lossless text clarity
            screenshot = canvas.toDataURL('image/png'); 
        } catch (e) {
            console.error("Screenshot Error:", e);
        }
    }


    const path = getDatePath(state.currentDate);
    const dataToSave = {
        author: state.author,
        isLocked: state.isLocked,
        pisAmount: state.pisAmount,
        giftOpen: { ...state.giftOpenCount },
        giftOut: { ...state.giftOutCount },
        giftClose: { ...state.giftCloseCount },
        cash: { ...state.cashCount },
        lastUpdated: new Date().getTime()
    };
    
    if (screenshot) dataToSave.screenshot = screenshot;

    try {
        await set(ref(db, path), dataToSave);
        
        // Save history snapshot if it's a lock action or contains actual content
        const hasContent = state.pisAmount !== null || state.author !== '' || Object.values(state.giftOpenCount).some(v => v !== null);
        if (doLock || (hasContent && Math.random() < 0.1)) { // random 10% chance for regular saves to avoid bloat, or 100% on lock
             await set(ref(db, getHistoryPath(state.currentDate)), dataToSave);
        }
    } catch (err) {
        console.error("Firebase Save Error:", err);
    }
}

async function loadData() {
    // Remove previous listener if exists
    if (currentListener) {
        currentListener();
        currentListener = null;
    }

    if (state.viewMode === 'monthly' || state.viewMode === 'weekly') {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        
        let startStr, endStr;
        if (state.viewMode === 'monthly') {
            const lastDay = new Date(year, month + 1, 0).getDate();
            const y = year;
            const m = String(month + 1).padStart(2, '0');
            startStr = `${y}-${m}-01`;
            endStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
        } else {
            const range = getMonthWeekRange(state.currentDate);
            const s = range.start;
            const e = range.end;
            startStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
            endStr = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
        }
        
        const dbRef = ref(db, `closing_v2/daily`);
        const snapshot = await get(dbRef);
        const allData = snapshot.val() || {};

        processAggregation(allData, state.viewMode, startStr, endStr);
    } else {
        // Real-time listener for Daily view
        const path = getDatePath(state.currentDate);
        const dataRef = ref(db, path);

        currentListener = onValue(dataRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                state.pisAmount = (data.pisAmount !== undefined) ? data.pisAmount : null;
                state.author = data.author || '';
                state.isLocked = data.isLocked || false;
                state.giftOpenCount = data.giftOpen || { 5000: null, 10000: null, 50000: null };
                state.giftOutCount = data.giftOut || { 5000: null, 10000: null, 50000: null };
                state.giftCloseCount = data.giftClose || { 5000: null, 10000: null, 50000: null };
                state.cashCount = data.cash || { 50000: null, 10000: null, 5000: null, 1000: null, 500: null, 100: null, 50: null, 10: null };
            } else {
                // No Data on Server
                resetStateForDay();
            }
            updateUIOnly();
        });
    }
}

function resetStateForDay() {
    state.pisAmount = null;
    state.author = '';
    state.isLocked = false;
    state.giftOpenCount = { 5000: null, 10000: null, 50000: null };
    state.giftOutCount = { 5000: null, 10000: null, 50000: null };
    state.giftCloseCount = { 5000: null, 10000: null, 50000: null };
    state.cashCount = { 50000: null, 10000: null, 5000: null, 1000: null, 500: null, 100: null, 50: null, 10: null };
}

// Function to handle UI updates from Firebase data without saving back
function updateUIOnly() {
    renderDate();
    syncFormsWithState();
    calculateTotals();
    applyLockVisuals();
}

function processAggregation(allData, mode, startStr, endStr) {
    // Reset totals
    state.pisAmount = 0;
    state.giftOpenCount = { 5000: null, 10000: null, 50000: null };
    state.giftOutCount = { 5000: 0, 10000: 0, 50000: 0 };
    state.giftCloseCount = { 5000: null, 10000: null, 50000: null };

    const dailyDiscrepancies = [];
    
    // Using string comparison (YYYY-MM-DD) for 100% robustness over timezones
    const targetDates = Object.keys(allData).filter(key => {
        return key >= startStr && key <= endStr;
    }).sort();

    if (targetDates.length === 0) {
        renderAggregatedUI(dailyDiscrepancies, mode);
        return;
    }

    // 1. Opening: Find the FIRST day in the range that actually has non-empty opening data
    for (let i = 0; i < targetDates.length; i++) {
        const dData = allData[targetDates[i]];
        if (dData && dData.giftOpen && Object.values(dData.giftOpen).some(v => v !== null && v !== '')) {
            state.giftOpenCount = { ...dData.giftOpen };
            break;
        }
    }

    // 2. Closing: Find the LAST day in the range that actually has non-empty closing data
    for (let i = targetDates.length - 1; i >= 0; i--) {
        const dData = allData[targetDates[i]];
        if (dData && dData.giftClose && Object.values(dData.giftClose).some(v => v !== null && v !== '')) {
            state.giftCloseCount = { ...dData.giftClose };
            break;
        }
    }

    // 3. Totals and Diffs
    targetDates.forEach(key => {
        const dData = allData[key];
        const day = key.split('-').pop();
        const month = key.split('-')[1];

        // PIS & Gift Out Sum
        state.pisAmount += (dData.pisAmount || 0);
        if (dData.giftOut) {
            Object.keys(dData.giftOut).forEach(k => {
                state.giftOutCount[k] = (state.giftOutCount[k] || 0) + (dData.giftOut[k] || 0);
            });
        }

        // Daily Diff Calc
        let dOpenTotal = 0;
        if (dData.giftOpen) Object.keys(dData.giftOpen).forEach(k => dOpenTotal += ((dData.giftOpen[k] || 0) * Number(k)));
        let dOutTotal = 0;
        if (dData.giftOut) Object.keys(dData.giftOut).forEach(k => dOutTotal += ((dData.giftOut[k] || 0) * Number(k)));
        let dCloseTotal = 0;
        if (dData.giftClose) Object.keys(dData.giftClose).forEach(k => dCloseTotal += ((dData.giftClose[k] || 0) * Number(k)));

        const dSystemTotal = dOpenTotal + dOutTotal - (dData.pisAmount || 0);
        const dDiff = dCloseTotal - dSystemTotal;
        if (dDiff !== 0) {
            dailyDiscrepancies.push({ l: `${parseInt(month)}월 ${parseInt(day)}일`, diff: dDiff });
        }
    });

    renderAggregatedUI(dailyDiscrepancies, mode);
}

function renderAggregatedUI(dailyDiscrepancies, mode) {
    if (elements.monthlyDiscrepancyList) {
        elements.monthlyDiscrepancyList.innerHTML = '';
        if (dailyDiscrepancies.length > 0) {
            dailyDiscrepancies.forEach(item => {
                const card = document.createElement('div');
                card.className = `result-item full-width ${item.diff > 0 ? 'surplus highlight' : 'shortage'}`;
                card.innerHTML = `
                    <span class="label">특이사항</span>
                    <span class="value">${item.l} : ${item.diff > 0 ? '+' : ''}${formatCurrency(item.diff)}</span>
                `;
                elements.monthlyDiscrepancyList.appendChild(card);
            });
        } else {
            elements.monthlyDiscrepancyList.innerHTML = `
                <div class="result-item full-width highlight">
                    <span class="label">특이사항</span>
                    <span class="value">정산 내역이 일치하거나 데이터가 없습니다.</span>
                </div>
            `;
        }
    }
    updateUIOnly();
}

function syncFormsWithState() {
    if (elements.inputAuthor) elements.inputAuthor.value = state.author || '';
    if (elements.finalBook) {
        const val = state.pisAmount;
        const textVal = (val === null || val === undefined || isNaN(val)) ? '' : formatNumber(val);
        elements.finalBook.value = textVal;
        const pisSpan = document.getElementById('monthly-pis-text');
        if (pisSpan) pisSpan.textContent = textVal || '0';
    }

    elements.giftOpenInputs.forEach(input => {
        const val = state.giftOpenCount[input.getAttribute('data-value')];
        const textVal = (val === null || val === undefined || isNaN(val)) ? '' : formatNumber(val);
        input.value = textVal;
        const span = input.nextElementSibling;
        if (span && span.classList.contains('monthly-text')) span.textContent = textVal;
    });
    elements.giftOutInputs.forEach(input => {
        const val = state.giftOutCount[input.getAttribute('data-value')];
        const textVal = (val === null || val === undefined || isNaN(val)) ? '' : formatNumber(val);
        input.value = textVal;
        const span = input.nextElementSibling;
        if (span && span.classList.contains('monthly-text')) span.textContent = textVal;
    });
    elements.giftCloseInputs.forEach(input => {
        const val = state.giftCloseCount[input.getAttribute('data-value')];
        const textVal = (val === null || val === undefined || isNaN(val)) ? '' : formatNumber(val);
        input.value = textVal;
        const span = input.nextElementSibling;
        if (span && span.classList.contains('monthly-text')) span.textContent = textVal;
    });
}

function applyLockVisuals() {
    const isMonthly = state.viewMode === 'monthly';
    const isWeekly = state.viewMode === 'weekly';
    const isLocked = state.isLocked && !isMonthly && !isWeekly;
    const isAdmin = state.userMode === 'admin';

    const inputsDisabled = isMonthly || isWeekly || (isLocked && !isAdmin);

    const allInputs = [...elements.giftOpenInputs, ...elements.giftOutInputs, ...elements.giftCloseInputs, ...elements.cashInputs, elements.finalBook, elements.inputAuthor];
    allInputs.forEach(input => {
        if (input) {
            input.disabled = inputsDisabled;
            if (isLocked) {
                input.style.backgroundColor = !isAdmin ? '#f1f5f9' : '#fff7ed';
            } else {
                input.style.backgroundColor = '';
            }
        }
    });

    if (elements.guestHeader) elements.guestHeader.style.display = isAdmin ? 'none' : 'flex';
    if (elements.adminHeader) elements.adminHeader.style.display = isAdmin ? 'flex' : 'none';

    if (elements.btnSaveAll) {
        if (isLocked) {
            elements.btnSaveAll.disabled = !isAdmin;
            elements.btnSaveAll.textContent = isAdmin ? '일 마감 취소' : '마감 완료';
            elements.btnSaveAll.style.backgroundColor = isAdmin ? '#ef4444' : '#64748b';
        } else {
            elements.btnSaveAll.disabled = (elements.inputAuthor && elements.inputAuthor.value.trim() === '') || isMonthly || isWeekly;
            elements.btnSaveAll.textContent = '일 마감';
            elements.btnSaveAll.style.backgroundColor = '';
        }
    }

    if (elements.navMonthly) elements.navMonthly.style.display = isAdmin ? 'block' : 'none';
    if (elements.navWeekly) elements.navWeekly.style.display = isAdmin ? 'block' : 'none';
    if (elements.navHistory) elements.navHistory.style.display = isAdmin ? 'block' : 'none';

    if (elements.monthlyDiscrepancyList) elements.monthlyDiscrepancyList.style.display = (state.viewMode === 'monthly' || state.viewMode === 'weekly') ? 'contents' : 'none';

    const isHistory = state.viewMode === 'history';
    document.body.classList.toggle('monthly-mode', isMonthly || isWeekly);
    document.body.classList.toggle('history-mode', isHistory);
}


function renderDate() {
    if (state.viewMode === 'monthly') {
        const options = { year: 'numeric', month: 'long' };
        elements.displayDate.textContent = state.currentDate.toLocaleDateString('ko-KR', options);
    } else if (state.viewMode === 'weekly') {
        const { start, end } = getMonthWeekRange(state.currentDate);
        const formatOptions = { month: 'long', day: 'numeric' };
        elements.displayDate.textContent = `${start.toLocaleDateString('ko-KR', formatOptions)} ~ ${end.toLocaleDateString('ko-KR', formatOptions)}`;
    } else {
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        elements.displayDate.textContent = state.currentDate.toLocaleDateString('ko-KR', options);
    }
}

function calculateTotals() {
    let giftOpenTotal = 0;
    elements.giftOpenInputs.forEach(input => {
        const val = Number(input.getAttribute('data-value'));
        const count = parseNumber(input.value);
        const total = val * count;
        giftOpenTotal += total;
        const el = document.getElementById(`gift-open-${val}`);
        if (el) el.textContent = formatCurrency(total);
    });

    let giftOutTotal = 0;
    elements.giftOutInputs.forEach(input => {
        const val = Number(input.getAttribute('data-value'));
        const count = parseNumber(input.value);
        const total = val * count;
        giftOutTotal += total;
        const el = document.getElementById(`gift-out-${val}`);
        if (el) el.textContent = formatCurrency(total);
    });

    let giftCloseTotal = 0;
    elements.giftCloseInputs.forEach(input => {
        const val = Number(input.getAttribute('data-value'));
        const count = parseNumber(input.value);
        const total = val * count;
        giftCloseTotal += total;
        const el = document.getElementById(`gift-close-${val}`);
        if (el) el.textContent = formatCurrency(total);
    });

    const bookBalance = parseNumber(elements.finalBook ? elements.finalBook.value : '0');
    const systemTotal = giftOpenTotal + giftOutTotal - bookBalance;
    const combinedPhysical = giftCloseTotal;
    const difference = systemTotal; // Using this variable name to avoid breaking UI logic if it still expects 'difference' as the indicator value

    if (elements.displayGiftOpenTotal) elements.displayGiftOpenTotal.textContent = formatCurrency(giftOpenTotal);
    if (elements.displayGiftOutTotal) elements.displayGiftOutTotal.textContent = formatCurrency(giftOutTotal);
    if (elements.displayGiftCloseTotal) elements.displayGiftCloseTotal.textContent = formatCurrency(giftCloseTotal);

    if (elements.finalPhysical) elements.finalPhysical.textContent = formatCurrency(combinedPhysical);

    if (elements.totalDiff) {
        elements.totalDiff.textContent = formatCurrency(systemTotal);
    }

    const finalDiff = combinedPhysical - systemTotal;
    if (elements.finalDiscrepancy) {
        if (finalDiff === 0) {
            elements.finalDiscrepancy.textContent = '0원';
        } else {
            elements.finalDiscrepancy.textContent = (finalDiff > 0 ? '+' : '') + formatCurrency(finalDiff);
        }
    }

    if (elements.diffContainer) {
        elements.diffContainer.classList.remove('shortage', 'surplus', 'highlight');
        if (finalDiff < 0) {
            elements.diffContainer.classList.add('shortage');
        } else if (finalDiff > 0) {
            elements.diffContainer.classList.add('surplus');
        } else {
            elements.diffContainer.classList.add('highlight'); // Zero difference
        }
    }
}

// Custom Calendar Logic
function openCalendar() {
    calViewDate = new Date(state.currentDate);
    renderCalendar();
    elements.calendarModal.classList.add('active');
}

function closeCalendar() {
    elements.calendarModal.classList.remove('active');
}

// History Logic
async function openHistory() {
    const y = state.currentDate.getFullYear();
    const m = String(state.currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(state.currentDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    elements.historyList.innerHTML = '<div class="empty-msg">기록을 불러오는 중...</div>';

    try {
        const historyRef = ref(db, `closing_v2/history/${dateStr}`);
        const snapshot = await get(historyRef);
        const historyData = snapshot.val();

        elements.historyList.innerHTML = '';
        if (!historyData) {
            elements.historyList.innerHTML = '<div class="empty-msg">해당 일자의 백업 기록이 없습니다.</div>';
            return;
        }

        // Display in reverse chronological order
        const timestamps = Object.keys(historyData).sort((a, b) => b - a);
        timestamps.forEach(ts => {
            const data = historyData[ts];
            const dateObj = new Date(Number(ts));
            const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const item = document.createElement('div');
            item.className = 'history-item';
            
            let photoBtn = '';
            if (data.screenshot) {
                photoBtn = `<button class="btn-view-img" data-ts="${ts}">📸 사진 보기</button>`;
            }

            item.innerHTML = `
                <div class="history-info">
                    <span class="history-time">${timeStr} 스냅샷</span>
                    <span class="history-author">작성자: ${data.author || '미지정'}</span>
                </div>
                <div class="history-actions">
                    ${photoBtn}
                    <button class="btn-restore" data-ts="${ts}">🔄 복구</button>
                    <button class="btn-delete-history" data-ts="${ts}">🗑️ 삭제</button>
                </div>
            `;
            
            if (data.screenshot) {
                item.querySelector('.btn-view-img').onclick = () => openImagePreview(data, timeStr);
            }
            item.querySelector('.btn-restore').onclick = () => restoreHistory(data, timeStr);
            item.querySelector('.btn-delete-history').onclick = () => deleteHistory(dateStr, ts, timeStr);
            elements.historyList.appendChild(item);
        });
    } catch (err) {
        console.error("History Load Error:", err);
        elements.historyList.innerHTML = '<div class="empty-msg">기록을 불러오는 중 오류가 발생했습니다.</div>';
    }
}

function closeHistory() {
    // No longer needed for tab view
}

function openImagePreview(data, timeStr) {
    if (elements.previewImg) elements.previewImg.src = data.screenshot;
    if (elements.imageModal) elements.imageModal.classList.add('active');
    
    if (elements.btnImageRestore) {
        elements.btnImageRestore.onclick = () => {
            closeImagePreview();
            restoreHistory(data, timeStr);
        };
    }
}

function closeImagePreview() {
    if (elements.imageModal) elements.imageModal.classList.remove('active');
}

async function restoreHistory(data, timeStr) {
    if (!confirm(`${timeStr} 시점의 데이터로 복원하시겠습니까?\n현재 입력된 데이터는 덮어씌워집니다.`)) return;
    
    // Update state with historical data
    state.pisAmount = (data.pisAmount !== undefined) ? data.pisAmount : null;
    state.author = data.author || '';
    state.isLocked = data.isLocked || false;
    state.giftOpenCount = data.giftOpen || { 5000: null, 10000: null, 50000: null };
    state.giftOutCount = data.giftOut || { 5000: null, 10000: null, 50000: null };
    state.giftCloseCount = data.giftClose || { 5000: null, 10000: null, 50000: null };
    state.cashCount = data.cash || { 50000: null, 10000: null, 5000: null, 1000: null, 500: null, 100: null, 50: null, 10: null };
    
    updateUIOnly();
    await saveData(); // Save the restored state as the current state
    alert(`${timeStr} 데이터로 복원되었습니다.`);
    closeHistory();
}

async function deleteHistory(dateStr, ts, timeStr) {
    if (!confirm(`${timeStr} 백업 기록을 영구적으로 삭제하시겠습니까?\n삭제된 기록은 복구할 수 없습니다.`)) return;
    
    try {
        const historyRef = ref(db, `closing_v2/history/${dateStr}/${ts}`);
        await remove(historyRef);
        alert('백업 기록이 삭제되었습니다.');
        openHistory(); // Refresh the list
    } catch (err) {
        console.error("Delete Error:", err);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

function renderCalendar() {
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    elements.calMonthYear.textContent = `${year}년 ${month + 1}월`;
    elements.calendarDays.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day other-month';
        dayDiv.textContent = prevDaysInMonth - i;
        elements.calendarDays.appendChild(dayDiv);
    }
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.textContent = i;
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) dayDiv.classList.add('today');
        if (i === state.currentDate.getDate() && month === state.currentDate.getMonth() && year === state.currentDate.getFullYear()) dayDiv.classList.add('selected');
        dayDiv.onclick = () => {
            saveData();
            state.currentDate = new Date(year, month, i);
            loadData();
            renderDate();
            calculateTotals();
            closeCalendar();
        };
        elements.calendarDays.appendChild(dayDiv);
    }
}

function handleNumericInput(e) {
    calculateTotals();
    saveData();
}

function formatInputOnBlur(e) {
    const input = e.target;
    if (input.value === '') return;
    let val = parseNumber(input.value);
    input.value = formatNumber(val);
    calculateTotals();
}

function clearFormatOnFocus(e) {
    const input = e.target;
    if (input.value === '') return;
    let val = parseNumber(input.value);
    input.value = val;
    // Selection for easy overwriting
    setTimeout(() => input.select(), 0);
}

function blockNonNumeric(e) {
    const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'];
    if (allowed.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
    }
}

function setupEventListeners() {
    elements.btnPrevDay.addEventListener('click', () => {
        saveData();
        if (state.viewMode === 'monthly') {
            state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        } else if (state.viewMode === 'weekly') {
            const { start } = getMonthWeekRange(state.currentDate);
            state.currentDate = new Date(start);
            state.currentDate.setDate(state.currentDate.getDate() - 1);
        } else if (state.viewMode === 'history') {
            state.currentDate.setDate(state.currentDate.getDate() - 1);
            openHistory();
            updateUIOnly();
            return;
        } else {
            state.currentDate.setDate(state.currentDate.getDate() - 1);
        }
        loadData();
        renderDate();
        calculateTotals();
    });

    elements.btnNextDay.addEventListener('click', () => {
        saveData();
        if (state.viewMode === 'monthly') {
            state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        } else if (state.viewMode === 'weekly') {
            const { end } = getMonthWeekRange(state.currentDate);
            state.currentDate = new Date(end);
            state.currentDate.setDate(state.currentDate.getDate() + 1);
        } else if (state.viewMode === 'history') {
            state.currentDate.setDate(state.currentDate.getDate() + 1);
            openHistory();
            updateUIOnly();
            return;
        } else {
            state.currentDate.setDate(state.currentDate.getDate() + 1);
        }
        loadData();
        renderDate();
        calculateTotals();
    });

    const allInputs = [...elements.giftOpenInputs, ...elements.giftOutInputs, ...elements.giftCloseInputs];
    if (elements.finalBook) allInputs.push(elements.finalBook);

    allInputs.forEach(input => {
        input.addEventListener('input', handleNumericInput);
        input.addEventListener('focus', clearFormatOnFocus);
        input.addEventListener('blur', formatInputOnBlur);
        input.addEventListener('keydown', blockNonNumeric);
    });

    if (elements.inputAuthor) {
        elements.inputAuthor.addEventListener('input', () => {
            elements.btnSaveAll.disabled = elements.inputAuthor.value.trim() === '';
        });
    }

    if (elements.btnAdminLogin) {
        elements.btnAdminLogin.addEventListener('click', () => {
            const pwd = prompt('관리자 비밀번호를 입력하세요:');
            if (pwd === '0626') { // Simple preset password
                state.userMode = 'admin';
                loadData();
                renderDate();
                calculateTotals();
            } else {
                alert('비밀번호가 올바르지 않습니다.');
            }
        });
    }

    if (elements.btnAdminLogout) {
        elements.btnAdminLogout.addEventListener('click', () => {
            state.userMode = 'guest';
            loadData();
            renderDate();
            calculateTotals();
        });
    }

    if (elements.btnSaveAll) {
        elements.btnSaveAll.addEventListener('click', () => {
            const isAdmin = state.userMode === 'admin';
            const isLocked = state.isLocked;

            if (isLocked) {
                if (isAdmin) {
                    if (confirm('해당 일자의 마감을 취소하시겠습니까?\n취소 후에는 게스트를 포함한 모든 사용자가 데이터를 수정할 수 있습니다.')) {
                        state.isLocked = false;
                        saveData(); // Set lock flag to false implicitly
                        alert('일 마감이 취소되었습니다.');
                        loadData();
                        renderDate();
                        calculateTotals();
                    }
                }
                return;
            }

            if (confirm('일 마감을 완료하시겠습니까?\n마감 후에는 게스트 모드에서 수정할 수 없습니다.')) {
                saveData(true);
                alert('일 마감이 완료되었습니다.');
                loadData();
                renderDate();
                calculateTotals();
            }
        });
    }

    if (elements.navDaily) {
        elements.navDaily.addEventListener('click', () => {
            if (state.viewMode === 'daily') return;
            saveData();
            state.viewMode = 'daily';
            elements.navDaily.classList.add('active');
            if (elements.navMonthly) elements.navMonthly.classList.remove('active');
            if (elements.navWeekly) elements.navWeekly.classList.remove('active');
            if (elements.navHistory) elements.navHistory.classList.remove('active');
            loadData();
            renderDate();
            calculateTotals();
        });
    }

    if (elements.navMonthly) {
        elements.navMonthly.addEventListener('click', () => {
            if (state.viewMode === 'monthly') return;
            saveData();
            state.viewMode = 'monthly';
            elements.navMonthly.classList.add('active');
            elements.navDaily.classList.remove('active');
            if (elements.navWeekly) elements.navWeekly.classList.remove('active');
            if (elements.navHistory) elements.navHistory.classList.remove('active');
            loadData();
            renderDate();
            calculateTotals();
        });
    }

    if (elements.navWeekly) {
        elements.navWeekly.addEventListener('click', () => {
            if (state.viewMode === 'weekly') return;
            saveData();
            state.viewMode = 'weekly';
            elements.navWeekly.classList.add('active');
            elements.navDaily.classList.remove('active');
            if (elements.navMonthly) elements.navMonthly.classList.remove('active');
            if (elements.navHistory) elements.navHistory.classList.remove('active');
            loadData();
            renderDate();
            calculateTotals();
        });
    }

    if (elements.navHistory) {
        elements.navHistory.addEventListener('click', () => {
            if (state.viewMode === 'history') return;
            saveData();
            state.viewMode = 'history';
            elements.navHistory.classList.add('active');
            elements.navDaily.classList.remove('active');
            if (elements.navMonthly) elements.navMonthly.classList.remove('active');
            if (elements.navWeekly) elements.navWeekly.classList.remove('active');
            openHistory();
            updateUIOnly();
        });
    }

    if (elements.calendarTrigger) elements.calendarTrigger.addEventListener('click', openCalendar);
    if (elements.calendarOverlay) elements.calendarOverlay.addEventListener('click', closeCalendar);
    if (elements.calBtnPrev) elements.calBtnPrev.addEventListener('click', () => { calViewDate.setMonth(calViewDate.getMonth() - 1); renderCalendar(); if (state.viewMode === 'history') openHistory(); });
    if (elements.calBtnNext) elements.calBtnNext.addEventListener('click', () => { calViewDate.setMonth(calViewDate.getMonth() + 1); renderCalendar(); if (state.viewMode === 'history') openHistory(); });

    // History Event Listeners
    if (elements.navHistory) elements.navHistory.addEventListener('click', openHistory);

    // Image Preview Listeners
    if (elements.imageOverlay) elements.imageOverlay.addEventListener('click', closeImagePreview);
    if (elements.btnCloseImage) elements.btnCloseImage.addEventListener('click', closeImagePreview);
}

init();
