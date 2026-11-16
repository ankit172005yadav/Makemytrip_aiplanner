import { dateLabel, destinations, mapPoints, money, night, origins, stopAlternatives, tripCost, weekend, weekendPrompt } from '../travemoreTrip.js'
import { mountTravemoreMap } from '../travemoreMap.js'
import { itineraryDayColors, itineraryStopNumber } from '../itineraryRoutes.js'
import { indiaGuides } from '../indiaGuides.js'
import '../tokens.css'
import '../travemore.css'

const clean = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])
const action = (id, label, style = 'tm-chip') => `<button type="button" class="${style}" data-action="${id}">${clean(label)}</button>`
const dateRange = trip => `${dateLabel(trip.start)} – ${dateLabel(trip.end)}`
const people = count => `${count} traveller${count === 1 ? '' : 's'}`
const longDay = date => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date))
const initialTrip = () => ({
    origin: 'Delhi', searchCity: 'Bengaluru', city: 'Bengaluru', budget: 15000, travelers: 1, ...weekend,
    confirmed: false, budgetFixed: false, datesFixed: false, partyFixed: false,
    flight: 'early', stay: 'central', quiet: false, unavailable: false,
})
const planningStages = ['review', 'view']
const examples = [
    ['weekend', weekendPrompt],
    ['city', 'Plan a weekend in Bengaluru'],
    ['compare', 'Where can I go from Delhi?'],
]
const planActions = [
    ['quieter', 'Make Saturday quieter'], ['stays', 'Compare stays'],
    ['flights', 'Show a later flight'], ['why', 'Why this plan?'],
]
// Assistant buttons that commit a change it proposed get the assistant's colour.
const assistantCommit = new Set(['apply-quiet'])
const glyph = {
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
    bed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18v-12h2v8h6V8h6a4 4 0 0 1 4 4v6h-2v-2H5v2zm4.5-5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spark: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c.4 3.3 1.9 5 5.2 5.5v.1C9.9 7.6 8.4 9.3 8 12.6h-.1C7.5 9.3 6 7.6 2.7 7.1V7C6 6.5 7.5 4.8 7.9 1.5z"/></svg>',
}

// Compares the current Saturday with a pending proposal so the itinerary can show it as tracked changes.
function trackedDay(current, proposed) {
    const next = new Map(proposed.map(stop => [stop.key, stop]))
    const rows = current.map(stop => {
        const after = next.get(stop.key)
        if (!after) return { stop, state: 'removed' }
        return { stop: after, before: stop, state: after.time === stop.time ? 'same' : 'changed' }
    })
    const kept = new Set(current.map(stop => stop.key))
    for (const stop of proposed) if (!kept.has(stop.key)) rows.push({ stop, state: 'added' })
    return rows
}

function budgetBar(trip, cost, proposed) {
    const activitiesAfter = proposed ? proposed.activities : cost.activities
    const scale = Math.max(trip.budget, cost.total, proposed?.total ?? 0)
    const pct = value => (Math.max(0, value) / scale * 100).toFixed(3) + '%'
    const kept = Math.min(cost.activities, activitiesAfter)
    const cut = cost.activities - kept
    const added = activitiesAfter - kept
    const finalTotal = proposed ? proposed.total : cost.total
    const left = trip.budget - finalTotal
    const segments = [
        ['flights', cost.flights], ['stay', cost.lodge], ['activities', kept],
        ...(cut ? [['cut', cut]] : []), ...(added ? [['added', added]] : []),
        ...(trip.budget - cost.total - added > 0 ? [['left', trip.budget - cost.total - added]] : []),
    ]
    const over = finalTotal > trip.budget
    return `<div class="tm-bar" role="img" aria-label="${money(finalTotal)} of a ${money(trip.budget)} budget">
            ${segments.map(([kind, value]) => value > 0 ? `<i class="tm-seg tm-seg-${kind}" style="width:${pct(value)}"></i>` : '').join('')}
            ${over ? `<b class="tm-bar-limit" style="left:${pct(trip.budget)}"></b>` : ''}
        </div>
        <ul class="tm-legend">
            <li><i class="tm-seg-flights"></i>Flights <span>${money(cost.flights)}</span></li>
            <li><i class="tm-seg-stay"></i>Stay <span>${money(cost.lodge)}</span></li>
            <li><i class="tm-seg-activities"></i>Things to do <span>${proposed && proposed.activities !== cost.activities ? `<del>${money(cost.activities)}</del> <ins>${money(proposed.activities)}</ins>` : money(cost.activities)}</span></li>
            ${left > 0 ? `<li><i class="tm-seg-left"></i>Left over <span>${money(left)}</span></li>` : ''}
        </ul>`
}

function mountPlanner(root) {
    const composer = root.querySelector('form')
    const input = composer.elements.intent
    const sheet = root.querySelector('.tm-sheet')
    const viewTrip = root.querySelector('.tm-view-trip')
    const reviewSlot = root.querySelector('.tm-review-slot')
    const historyButton = root.querySelector('[data-action=history]')
    const mapPanel = root.querySelector('.tm-map-pane')
    const mapDock = root.querySelector('.tm-map-dock')
    const mapDetail = mapPanel.querySelector('.tm-map-detail')
    const dialog = root.querySelector('dialog')
    const dialogBody = dialog.querySelector('.tm-dialog-body')
    const announce = root.querySelector('.tm-announcer')
    const originContext = root.querySelector('#tm-search-origin')
    const cityContext = root.querySelector('#tm-search-city')
    let trip = initialTrip()
    let stage = 'start'
    let messages = []
    let undo = null
    let modal = ''
    const modalTrail = []
    let restoreAction = null
    let compareChoice = ''
    let activeDay = 'all'
    let airportVisible = false
    let mapSelection = ''
    let map
    let entryComposer
    let quietProposal = null
    let replacement = null
    let changedStop = ''

    const ready = () => stage === 'ready' || stage === 'approved'

    function selectStop(id, scroll = false) {
        for (const row of sheet.querySelectorAll('[data-stop]')) row.classList.toggle('tm-stop-selected', row.dataset.stop === id)
        if (scroll) sheet.querySelector(`[data-stop="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }

    // Map points for the current plan, plus the pending Saturday proposal drawn as outlined pins.
    function planPoints(cost) {
        const points = mapPoints(trip, cost, activeDay, airportVisible)
        if (!quietProposal || (activeDay !== 'all' && activeDay !== '0')) return { points, route: [] }
        const proposed = mapPoints({ ...trip, ...quietProposal }, tripCost({ ...trip, ...quietProposal }), '0', false)
        const keep = new Set(proposed.map(point => point.key))
        const have = new Set(points.filter(point => point.day === 0).map(point => point.key))
        const marked = points.map(point => point.day === 0 && !keep.has(point.key) ? { ...point, state: 'removed' } : point)
        const ghosts = proposed.filter(point => !have.has(point.key))
            .map(point => ({ ...point, id: 'proposed-' + point.key, state: 'proposed', label: 'Proposed · ' + point.label }))
        return { points: [...marked, ...ghosts], route: proposed.map(point => [point.lat, point.lng]) }
    }

    function refreshMap() {
        if (stage === 'start') return
        const cost = tripCost(trip)
        const { points, route } = ready() ? planPoints(cost) : { points: [], route: [] }
        if (!map) map = mountTravemoreMap(mapPanel.querySelector('.tm-map-canvas'), point => {
            mapSelection = point.id
            selectStop(point.id, !dialog.open)
            refreshMap()
        })
        map.update(trip.city, points, route)
        mapPanel.classList.toggle('tm-map-preview', !ready())
        for (const button of mapPanel.querySelectorAll('[data-map-day]')) {
            button.setAttribute('aria-pressed', String(button.dataset.mapDay === activeDay))
        }
        mapPanel.querySelector('[data-action=toggle-airport]').setAttribute('aria-pressed', String(airportVisible))
        const selected = points.find(point => point.id === mapSelection)
        for (const pin of mapPanel.querySelectorAll('.tm-map-marker')) {
            pin.classList.toggle('tm-map-selected', Boolean(selected && pin.dataset.stopId === selected.id))
        }
        mapDetail.innerHTML = selected
            ? `<div><strong>${clean(selected.title)}</strong><p>${clean([selected.label, selected.time, selected.duration].filter(Boolean).join(' · '))}</p></div>
                ${selected.state === 'proposed' ? '' : selected.kind === 'stay' ? action('stays', 'Compare stays', 'tm-link') : selected.kind === 'airport' ? action('flights', 'Compare flights', 'tm-link') : action('jump-' + selected.id, 'Show in plan', 'tm-link')}`
            : `<p>${ready() ? 'Select a stop to see where it sits in the day.' : `Your stay and things to do will appear here.`}</p>`
    }

    function showOnMap(id, opener) {
        mapSelection = id
        if (id === 'airport') airportVisible = true
        if (id === 'stay') activeDay = 'all'
        if (id.startsWith('day-')) activeDay = id.split('-')[1]
        if (!planPoints(tripCost(trip)).points.some(point => point.id === id)) mapSelection = 'stay'
        if (matchMedia('(max-width: 760px)').matches && modal !== 'view') {
            modalTrail.length = 0
            openModal('view', opener)
        } else if (dialog.open && modal !== 'view') {
            modalTrail.length = 0
            dialog.close()
        }
        refreshMap()
        selectStop(mapSelection)
        map?.focus(mapSelection)
    }

    // Every assistant message is pinned to the part of the plan it is about.
    function add(role, body, actions = [], anchor = 'top') {
        messages.push({ role, body, actions, anchor })
    }

    function removeActions(ids) {
        for (const message of messages) message.actions = message.actions.filter(([id]) => !ids.includes(id))
    }

    function planReason(cost = tripCost(trip)) {
        if (trip.flight === 'early' && trip.stay === 'central' && !trip.quiet) return cost.place.reason
        const pace = trip.quiet ? (trip.flight === 'late' ? ' Saturday is set aside for check-in and rest.' : ' Saturday has just one short outing.') : ''
        return cost.flight.note + ' ' + cost.stay.note + pace
    }

    function constraints() {
        return `<dl class="tm-facts">
          <div><dt>You told me</dt><dd>${[trip.origin, trip.budgetFixed && money(trip.budget) + ' total', trip.datesFixed && dateRange(trip), trip.confirmed && trip.city, trip.partyFixed && people(trip.travelers)].filter(Boolean).join(' · ')}</dd></div>
          <div><dt>I assumed</dt><dd>${[!trip.partyFixed && people(trip.travelers), !trip.datesFixed && dateRange(trip), !trip.budgetFixed && money(trip.budget) + ' total'].filter(Boolean).join(' · ') || 'Nothing'}</dd></div>
          <div><dt>Open to change</dt><dd>${trip.confirmed ? '' : 'Destination · '}Flight time · Stay area</dd></div>
          </dl>`
    }

    function savingAction(cost) {
        const alternatives = [
            ...cost.place.stays.filter(option => !trip.unavailable || option.id !== trip.stay)
                .map(option => ({ id: 'stays', name: option.name, total: tripCost(trip, trip.city, trip.flight, option.id).total })),
            ...cost.flightOptions.map(option => ({ id: 'flights', name: option.id === 'early' ? 'the early flight' : 'the later flight', total: tripCost(trip, trip.city, option.id).total })),
            ...(!trip.quiet ? [{ id: 'quieter', name: 'a quieter Saturday', total: tripCost({ ...trip, quiet: true }).total }] : []),
        ].sort((a, b) => a.total - b.total)
        const best = alternatives[0]
        if (best && best.total < cost.total) return `<p>Choose ${best.name} to save ${money(cost.total - best.total)}.${best.total > trip.budget ? ' The plan will still be above your limit.' : ''}</p><div class="tm-note-actions">${action(best.id, best.id === 'stays' ? 'Compare stays' : best.id === 'flights' ? 'Compare flights' : 'Make Saturday quieter')}</div>`
        return `<p>These options are already at their lowest price for ${trip.city}.</p><div class="tm-note-actions">${action('compare', 'Compare destinations')}</div>`
    }

    // The latest exchange: the traveller's last message and the assistant's replies to it.
    function currentTurn() {
        const lastUser = messages.findLastIndex(message => message.role === 'user')
        const turn = messages.slice(Math.max(0, lastUser))
        const replies = turn.filter(message => message.role === 'assistant')
        if (!replies.length) return null
        return { said: lastUser >= 0 ? messages[lastUser].body : '', replies, anchor: replies.at(-1).anchor }
    }

    function note(anchor, anchors) {
        const turn = currentTurn()
        if (!turn) return ''
        const where = anchors.includes(turn.anchor) ? turn.anchor : 'top'
        if (where !== anchor) return ''
        const actions = turn.replies.at(-1).actions
        return `<aside class="tm-note" data-note>
            <header><span class="tm-ai-mark">${glyph.spark}Travemore</span>${turn.said ? `<q>${clean(turn.said)}</q>` : ''}</header>
            ${turn.replies.map(reply => `<p>${clean(reply.body)}</p>`).join('')}
            ${actions.length ? `<div class="tm-note-actions">${actions.map(([id, label]) => action(id, label, assistantCommit.has(id) ? 'tm-btn tm-btn-ai' : 'tm-chip')).join('')}</div>` : ''}
        </aside>`
    }

    function why(text) {
        return text ? `<p class="tm-why">${glyph.spark}<span>${clean(text)}</span></p>` : ''
    }

    function stopRow(item, index, order, dayLength, { state = 'same', before } = {}, interactive = true) {
        const id = 'day-' + index + '-' + order
        const number = itineraryStopNumber(index, order)
        const time = state === 'changed'
            ? `<del>${before.time}</del><ins>${item.time}</ins>`
            : item.time
        const duration = state === 'changed' && before.duration !== item.duration ? `<del>${before.duration}</del> <ins>${item.duration}</ins>` : item.duration
        const tag = state === 'added' ? '<em class="tm-tag">Proposed</em>' : state === 'removed' ? '<em class="tm-tag tm-tag-off">Would be removed</em>' : ''
        const tracked = state !== 'same'
        return `<li class="tm-stop tm-stop-${state} ${!tracked && changedStop === id ? 'tm-stop-updated' : ''} ${!tracked && mapSelection === id ? 'tm-stop-selected' : ''}" ${tracked ? '' : `data-stop="${id}"`}>
            <button type="button" class="tm-stop-main" ${interactive && !tracked ? `data-action="map-${id}"` : interactive && state === 'added' ? `data-action="map-proposed-${item.key}"` : 'tabindex="-1"'}>
                <span class="tm-num" style="--day:${itineraryDayColors[index]}">${state === 'added' || state === 'removed' ? '' : number}</span>
                <span class="tm-stop-text"><strong>${clean(item.title)}</strong>${tag}<small>${clean(item.note)}</small></span>
                <span class="tm-stop-time">${time}<small>${duration}</small></span>
            </button>
            ${interactive && !tracked ? `<div class="tm-stop-tools">
                ${action('replace-' + index + '-' + order, 'Replace', 'tm-link')}
                ${order > 0 ? action('move-' + index + '-' + order + '-up', 'Move earlier', 'tm-link') : ''}
                ${order < dayLength - 1 ? action('move-' + index + '-' + order + '-down', 'Move later', 'tm-link') : ''}
            </div>` : ''}
        </li>`
    }

    function daySection(cost, index, proposedCost, interactive, anchors) {
        const day = cost.days[index]
        const date = index === 0 ? trip.start : trip.end
        const sum = list => list.reduce((total, stop) => total + stop.price * trip.travelers, 0)
        const pending = index === 0 && proposedCost
        const rows = pending ? trackedDay(day, proposedCost.days[0]) : day.map(stop => ({ stop, state: 'same' }))
        const before = sum(day)
        const after = pending ? sum(proposedCost.days[0]) : before
        let order = 0
        return `<section class="tm-group" id="tm-day-${index}">
            <header class="tm-group-head"><h3>${longDay(date)}</h3>
                <span>${after !== before ? `<del>${money(before)}</del> <ins>${after ? money(after) : 'Free'}</ins>` : before ? money(before) : 'Free'}</span>
                ${interactive ? action('day-' + index, 'Map', 'tm-link tm-link-quiet') : ''}</header>
            <ol class="tm-list">${rows.map(row => stopRow(row.stop, index, row.state === 'removed' ? -1 : order++, day.length, row, interactive)).join('')}</ol>
            ${interactive ? note('day-' + index, anchors) : ''}
        </section>`
    }

    function planSections(cost, { interactive = true } = {}) {
        const anchors = ['top', 'flights', 'stay', 'day-0', 'day-1']
        const proposedCost = interactive && quietProposal ? tripCost({ ...trip, ...quietProposal }) : null
        return `<section class="tm-group" id="tm-flights">
                <header class="tm-group-head"><h3>Flights</h3><span>${money(cost.flights)}</span></header>
                <ul class="tm-list">
                    <li class="tm-row"><span class="tm-icon">${glyph.plane}</span><span class="tm-row-text"><strong>${trip.origin} to ${trip.city}</strong><small>${cost.originAirport} → ${cost.place.airport} · ${dateLabel(trip.start)}</small></span><span class="tm-row-end">${cost.flight.outbound}</span></li>
                    <li class="tm-row"><span class="tm-icon tm-icon-back">${glyph.plane}</span><span class="tm-row-text"><strong>${trip.city} to ${trip.origin}</strong><small>${cost.place.airport} → ${cost.originAirport} · ${dateLabel(trip.end)}</small></span><span class="tm-row-end">${cost.flight.inbound}</span></li>
                </ul>
                ${interactive ? `<footer class="tm-group-foot">${why(cost.flight.note)}${action('flights', 'Compare flights', 'tm-link')}${action('map-airport', 'Airport on map', 'tm-link')}</footer>${note('flights', anchors)}` : ''}
            </section>
            <section class="tm-group" id="tm-stay">
                <header class="tm-group-head"><h3>Stay</h3><span>${money(cost.lodge)}</span></header>
                <ul class="tm-list">
                    <li class="tm-row ${trip.unavailable ? 'tm-row-alert' : ''}"><span class="tm-icon">${glyph.bed}</span><span class="tm-row-text"><strong>${clean(cost.stay.name)}</strong><small>${cost.stay.area} · 1 night · ${cost.rooms} room${cost.rooms > 1 ? 's' : ''}</small></span>
                        ${trip.unavailable ? '<span class="tm-row-end tm-warn-text">Unavailable</span>' : ''}</li>
                </ul>
                ${interactive ? `<footer class="tm-group-foot">${trip.unavailable ? '<p class="tm-why tm-warn-text">No longer available in this simulation. Pick a replacement; the rest of the trip stays as it is.</p>' : why(cost.stay.note)}
                    ${action('stays', trip.unavailable ? 'Find a replacement' : 'Compare stays', trip.unavailable ? 'tm-btn tm-btn-small' : 'tm-link')}${action('map-stay', 'Show on map', 'tm-link')}</footer>${note('stay', anchors)}` : ''}
            </section>
            ${cost.days.map((_, index) => daySection(cost, index, proposedCost, interactive, anchors)).join('')}`
    }

    function totalBlock(cost, proposedCost = null) {
        const finalTotal = proposedCost ? proposedCost.total : cost.total
        const difference = trip.budget - finalTotal
        return `<section class="tm-total">
            <div class="tm-total-head">
                <p class="tm-total-figure">${proposedCost && proposedCost.total !== cost.total ? `<del>${money(cost.total)}</del> <ins>${money(proposedCost.total)}</ins>` : money(cost.total)}<span>of ${money(trip.budget)}</span></p>
                <span class="tm-status ${difference < 0 ? 'tm-status-over' : ''}">${difference < 0 ? money(-difference) + ' over budget' : money(difference) + ' left'}</span>
            </div>
            ${budgetBar(trip, cost, proposedCost)}
        </section>`
    }

    function itinerary() {
        const cost = tripCost(trip)
        const anchors = ['top', 'flights', 'stay', 'day-0', 'day-1']
        const proposedCost = quietProposal ? tripCost({ ...trip, ...quietProposal }) : null
        return `<header class="tm-sheet-head">
                <p class="tm-eyebrow">${stage === 'approved' ? '<span class="tm-approved">Approved</span>' : ''}From ${trip.origin} · ${dateRange(trip)} · ${people(trip.travelers)} ${action('preferences', 'Edit', 'tm-link')}</p>
                <h1>${trip.city}</h1>
            </header>
            ${totalBlock(cost, proposedCost)}
            ${cost.total > trip.budget ? `<aside class="tm-note tm-note-warn"><header><span class="tm-ai-mark">${glyph.spark}Over budget</span></header>${savingAction(cost)}</aside>` : ''}
            ${note('top', anchors)}
            ${planSections(cost)}
            <details class="tm-disclosure"><summary>How I read your request</summary>${constraints()}</details>
            <p class="tm-fineprint">Meals and local transport are not included. Prices and availability are simulated.</p>`
    }

    function brief() {
        const cost = tripCost(trip)
        return `<header class="tm-sheet-head">
                <p class="tm-eyebrow">${stage === 'compare' ? 'Comparing destinations' : 'New weekend'}</p>
                <h1>${stage === 'compare' ? 'Where to?' : trip.searchCity ? trip.searchCity + '?' : 'Where to?'}</h1>
            </header>
            ${note('top', ['top'])}
            <section class="tm-group">
                <header class="tm-group-head"><h3>What I have so far</h3>${action('preferences', 'Edit', 'tm-link')}</header>
                <dl class="tm-list tm-brief">
                    <div class="tm-row"><dt>From</dt><dd>${trip.origin} <small>${cost.originAirport}</small></dd></div>
                    <div class="tm-row"><dt>To</dt><dd>${trip.searchCity ? trip.searchCity + ' <small>from your search</small>' : '<span class="tm-muted">Open</span>'}</dd></div>
                    <div class="tm-row"><dt>When</dt><dd>${dateRange(trip)}</dd></div>
                    <div class="tm-row"><dt>Who</dt><dd>${people(trip.travelers)}</dd></div>
                    <div class="tm-row"><dt>Budget</dt><dd>${money(trip.budget)} <small>whole trip</small></dd></div>
                </dl>
            </section>
            <details class="tm-disclosure"><summary>How I read your request</summary>${constraints()}</details>`
    }

    function render({ scroll = false, changed = '' } = {}) {
        const cost = tripCost(trip)
        const priorStage = root.dataset.stage
        root.dataset.reveal = String(ready() && ['start', 'clarify', 'compare'].includes(priorStage))
        root.dataset.stage = stage
        root.dataset.changed = changed
        sheet.innerHTML = stage === 'start' ? '' : ready() ? itinerary() : brief()
        viewTrip.innerHTML = ready() ? action('view', 'Map', 'tm-btn tm-btn-plain') : ''
        reviewSlot.innerHTML = ready()
            ? `<button type="button" class="tm-btn" data-action="review">${stage === 'approved' ? 'View approved trip' : 'Review trip'}<span>${money(cost.total)}</span></button>`
            : ''
        const said = messages.filter(message => message.role === 'assistant').length
        historyButton.hidden = !said
        historyButton.querySelector('span').textContent = said
        originContext.value = trip.origin
        cityContext.value = trip.searchCity
        refreshMap()
        input.placeholder = ready() ? 'Ask for a change…' : 'A weekend away, a place, or a budget…'
        if (entryComposer) {
            const position = composer.getBoundingClientRect()
            const offset = Math.max(-140, Math.min(140, entryComposer.top - position.top))
            const timing = { duration: 320, easing: 'cubic-bezier(.25,.1,.25,1)' }
            composer.animate([{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }], timing)
            sheet.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { ...timing, delay: 60, fill: 'backwards' })
            entryComposer = null
        }
        if (scroll) requestAnimationFrame(() => sheet.querySelector('[data-note]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
        if (changed) announce.textContent = `Trip updated. Estimated total ${money(cost.total)} for ${people(trip.travelers)}.`
    }

    function recommend(city) {
        trip = { ...trip, city, confirmed: true, stay: 'central', flight: 'early', quiet: false, unavailable: false, stopOrder: {}, stopOverrides: {} }
        undo = null
        removeActions(['choose-Bengaluru', 'choose-Jaipur', 'compare', 'undo', 'apply-quiet', 'cancel-quiet'])
        quietProposal = null
        changedStop = ''
        activeDay = 'all'
        airportVisible = false
        mapSelection = ''
        stage = 'ready'
        const cost = tripCost(trip)
        const price = cost.total <= trip.budget
            ? `${money(cost.total)} for ${people(trip.travelers)}, ${money(trip.budget - cost.total)} under your total budget.`
            : `${money(cost.total)} for ${people(trip.travelers)}, ${money(cost.total - trip.budget)} over your total budget. I’ve put the cheapest changes next to the estimate.`
        add('assistant', `${city}, ${dateRange(trip)}. ${planReason(cost)} ${price}`, planActions)
        render({ scroll: true })
        announce.textContent = `Trip ready. Estimated total ${money(cost.total)}.`
    }

    function compareDestinations() {
        const cities = Object.keys(destinations).map(city => {
            const cost = tripCost({ ...trip, flight: 'early', stay: 'central', quiet: false }, city)
            return { city, total: cost.total }
        })
        if (stage !== 'ready' && stage !== 'approved') stage = 'compare'
        if (dialog.open) {
            modalTrail.length = 0
            dialog.close()
        }
        add('assistant', `Same dates, ${people(trip.travelers)}. Jaipur comes to ${money(cities[1].total)} with more Saturday time in the old city. Bengaluru comes to ${money(cities[0].total)} with a central stay near the park. Which would you like to plan?`, [
            ['choose-Jaipur', `Jaipur · ${money(cities[1].total)}`],
            ['choose-Bengaluru', `Bengaluru · ${money(cities[0].total)}`],
        ])
        render({ scroll: true })
    }

    function openModal(next, opener) {
        if (!dialog.open) {
            restoreAction = opener?.dataset.action || null
            dialog.showModal()
        }
        modal = next
        compareChoice = ''
        renderModal()
        dialog.scrollTop = 0
        dialog.querySelector('[data-modal-title]').focus({ preventScroll: true })
    }

    function renderModal() {
        const cost = tripCost(trip)
        const titles = { view: 'Map', review: 'Review your trip', stays: 'Compare stays', flights: 'Compare flights', preferences: 'Trip details', approved: 'Trip approved', stop: 'Replace stop', history: 'Conversation' }
        dialog.dataset.screen = modal
        let body = ''
        if (modal === 'view') body = '<div class="tm-mobile-map-dock"></div>'
        if (modal === 'history') {
            body = `<ol class="tm-history">${messages.map(message => `<li class="tm-history-${message.role}">
                ${message.role === 'assistant' ? `<span class="tm-ai-mark">${glyph.spark}Travemore</span>` : '<span class="tm-you">You</span>'}<p>${clean(message.body)}</p></li>`).join('')}</ol>`
        }
        if (modal === 'stop' && replacement) {
            const current = cost.days[replacement.day][replacement.order]
            const options = stopAlternatives(trip.city, current.key)
                .filter(option => !cost.days.flat().some(stop => stop.title === option.title))
            body = `<p class="tm-dialog-sub">Instead of ${clean(current.title)} at ${current.start}. The time slot stays the same.</p>
                ${options.length ? `<ul class="tm-list tm-options">${options.map(option => `<li class="tm-row">
                    <span class="tm-row-text"><strong>${clean(option.title)}</strong><small>${clean(option.note)}</small></span>
                    <span class="tm-row-end">${option.price ? money(option.price) : 'Free'}</span>${action('use-stop-' + option.key, 'Use', 'tm-btn tm-btn-small')}</li>`).join('')}</ul>`
                : '<p class="tm-muted">No other stops are available for this time slot.</p>'}`
        }
        if (modal === 'review') {
            body = `<p class="tm-dialog-sub">${trip.origin} ↔ ${trip.city} · ${dateRange(trip)} · ${people(trip.travelers)}</p>
                ${totalBlock(cost)}
                ${cost.total > trip.budget ? `<aside class="tm-note tm-note-warn"><header><span class="tm-ai-mark">${glyph.spark}Over budget</span></header>${savingAction(cost)}</aside>` : ''}
                ${planSections(cost, { interactive: false })}
                <div class="tm-dialog-links">${action('preferences', 'Edit trip details', 'tm-link')}${action('availability', 'Recheck stay availability', 'tm-link')}</div>
                <footer class="tm-dialog-foot"><p class="tm-fineprint">Prices and availability are simulated.</p>${action('chat', 'Back to plan', 'tm-btn tm-btn-plain')}
                    <button type="button" class="tm-btn" data-action="approve" ${trip.unavailable || cost.total > trip.budget ? 'disabled' : ''}>Approve trip</button>
                </footer>`
        }
        if (modal === 'stays' || modal === 'flights') {
            const options = modal === 'stays' ? cost.place.stays : cost.flightOptions
            const current = modal === 'stays' ? trip.stay : trip.flight
            body = `<ul class="tm-list tm-options">${options.map(option => {
                const isCurrent = option.id === current
                const unavailable = modal === 'stays' && isCurrent && trip.unavailable
                const selected = option.id === compareChoice
                const newCost = modal === 'stays' ? tripCost(trip, trip.city, trip.flight, option.id) : tripCost(trip, trip.city, option.id)
                const diff = newCost.total - cost.total
                const label = modal === 'stays' ? option.name : option.id === 'early' ? 'Early departure' : 'Later departure'
                const detail = modal === 'stays' ? option.area : cost.originAirport + ' → ' + cost.place.airport + ' · ' + option.outbound
                const delta = isCurrent ? (unavailable ? '<span class="tm-warn-text">Unavailable</span>' : '<span class="tm-current">Current</span>')
                    : `<span class="tm-delta ${diff < 0 ? 'tm-delta-less' : ''}">${diff === 0 ? 'Same total' : (diff < 0 ? '−' : '+') + money(Math.abs(diff))}</span>`
                const inner = `<span class="tm-check" aria-hidden="true"></span>
                    <span class="tm-row-text"><strong>${clean(label)}</strong><small>${clean(detail)}</small><small>${clean(option.note)}</small></span>
                    <span class="tm-row-end">${money(modal === 'stays' ? newCost.lodge : newCost.flights)}${delta}</span>`
                return `<li class="tm-option ${selected ? 'tm-selected' : ''} ${isCurrent ? 'tm-option-current' : ''}">${isCurrent
                    ? `<div class="tm-option-main">${inner}</div>`
                    : `<button type="button" class="tm-option-main" data-action="preview-${option.id}" aria-pressed="${selected}">${inner}</button>`}</li>`
            }).join('')}</ul>`
            if (compareChoice) {
                const next = modal === 'stays' ? tripCost(trip, trip.city, trip.flight, compareChoice) : tripCost(trip, trip.city, compareChoice)
                body += `<footer class="tm-dialog-foot"><p><strong>${money(next.total)}</strong> new total · ${money(Math.abs(trip.budget - next.total))} ${trip.budget >= next.total ? 'under' : 'over'} budget</p>
                    ${action('apply', 'Apply change', 'tm-btn')}</footer>`
            }
        }
        if (modal === 'preferences') {
            body = `<p class="tm-dialog-sub">Leaving from ${trip.origin}. The budget covers everyone.</p>
                <form class="tm-form"><div class="tm-list">
                <label class="tm-row">Budget (₹)<input name="budget" type="number" min="1000" max="1000000" step="1" required value="${trip.budget}"></label>
                <label class="tm-row">Travellers<input name="travelers" type="number" min="1" max="8" step="1" required value="${trip.travelers}"></label>
                <label class="tm-row">Depart<input name="start" type="date" required value="${trip.start}"></label>
                <label class="tm-row">Return<input name="end" type="date" required value="${trip.end}"></label></div>
                <p class="tm-warn-text" role="alert" data-form-error></p><button class="tm-btn tm-btn-wide">Save</button></form>`
        }
        if (modal === 'approved') body = `<div class="tm-done"><span class="tm-done-mark" aria-hidden="true">✓</span>
            <p><strong>${trip.city}, ${dateRange(trip)}</strong><br>${people(trip.travelers)} · ${money(cost.total)}</p>
            <p class="tm-fineprint">Approved in this prototype. Nothing has been booked.</p>${action('close', 'Done', 'tm-btn tm-btn-wide')}</div>`
        dialogBody.innerHTML = `<header class="tm-dialog-header"><h2 id="tm-modal-title" data-modal-title tabindex="-1">${titles[modal]}</h2>
            <button type="button" class="tm-close" data-action="close" aria-label="Close ${titles[modal].toLowerCase()}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></header>
            <div class="tm-dialog-content">${body}</div>`
        const dock = dialogBody.querySelector('.tm-mobile-map-dock') || mapDock
        if (mapPanel.parentElement !== dock) dock.append(mapPanel)
    }

    function closeModal() {
        if (modalTrail.length) {
            openModal(modalTrail.pop())
        } else {
            dialog.close()
        }
    }

    function editOption(kind, opener) {
        if (planningStages.includes(modal)) modalTrail.push(modal)
        openModal(kind, opener)
    }

    function update(fields, changed, message, canUndo = true) {
        quietProposal = null
        removeActions(['undo', 'apply-quiet', 'cancel-quiet'])
        if (changed !== 'activity') changedStop = ''
        undo = canUndo ? { fields: Object.fromEntries(Object.keys(fields).map(key => [key, trip[key]])), changed } : null
        trip = { ...trip, ...fields }
        if (stage === 'approved') stage = 'ready'
        const anchor = { flights: 'flights', stays: 'stay', activity: changedStop ? 'day-' + changedStop.split('-')[1] : 'day-0' }[changed] ?? 'top'
        add('assistant', message, canUndo ? [['undo', 'Undo change']] : [], anchor)
        render({ scroll: true, changed })
        if (dialog.open && planningStages.includes(modal)) renderModal()
    }

    function suggestQuiet() {
        if (trip.flight === 'late') {
            add('assistant', 'Saturday already has just hotel check-in after the later flight. I can help you shorten a Sunday stop instead.', [], 'day-0')
            return render({ scroll: true })
        }
        removeActions(['apply-quiet', 'cancel-quiet'])
        const saturdayKeys = new Set(tripCost(trip).days[0].map(stop => stop.key))
        const stopOverrides = Object.fromEntries(Object.entries(trip.stopOverrides || {}).filter(([key]) => !saturdayKeys.has(key)))
        const next = { quiet: !trip.quiet, stopOrder: { ...trip.stopOrder, 0: [] }, stopOverrides }
        const cost = tripCost({ ...trip, ...next })
        quietProposal = next
        activeDay = '0'
        mapSelection = ''
        const changes = cost.days[0].map(stop => stop.title + ' (' + stop.duration + ')').join(' and ')
        if (dialog.open) {
            modalTrail.length = 0
            dialog.close()
        }
        add('assistant', `I’d ${next.quiet ? 'make Saturday lighter' : 'restore the original Saturday'} with ${changes}. Flights, Sunday and your stay will stay in the plan. New estimate ${money(cost.total)}.`, [['apply-quiet', 'Apply Saturday edit'], ['cancel-quiet', 'Keep current plan']], 'day-0')
        render({ scroll: true })
    }

    function revealEditedStop(day, order) {
        activeDay = String(day)
        changedStop = 'day-' + day + '-' + order
        mapSelection = changedStop
    }

    function reorderStop(day, order, direction) {
        const stops = tripCost(trip).days[day]
        const next = order + (direction === 'up' ? -1 : 1)
        if (!stops[next]) return
        const keys = stops.map(stop => stop.key)
        keys[order] = stops[next].key
        keys[next] = stops[order].key
        revealEditedStop(day, next)
        update({ stopOrder: { ...trip.stopOrder, [day]: keys } }, 'activity', `Moved ${stops[order].title} ${direction === 'up' ? 'earlier' : 'later'} in the day.`)
        selectStop(changedStop, true)
    }

    function applyOption() {
        if (!compareChoice) return
        const fields = modal === 'stays' ? { stay: compareChoice, unavailable: false } : { flight: compareChoice }
        const cost = tripCost({ ...trip, ...fields })
        const label = modal === 'stays' ? `Stay changed to ${cost.stay.name}. ${cost.stay.note}` : `Flights updated. ${cost.flight.note}`
        update(fields, modal, `${label} The new total is ${money(cost.total)}.`)
        closeModal()
    }

    function showAvailability() {
        if (trip.stay !== 'central' || trip.unavailable) {
            add('assistant', trip.unavailable ? 'Your current stay is unavailable in this scenario. Choose a replacement to keep the rest of your trip.' : 'Your current stay is still available in the simulation.', trip.unavailable ? [['stays', 'Find a replacement']] : [], 'stay')
            render({ scroll: true })
            if (dialog.open && trip.unavailable) renderModal()
            else if (dialog.open) {
                const note = document.createElement('p')
                note.className = 'tm-budget'
                note.setAttribute('role', 'status')
                note.textContent = 'Your current stay is available in the simulation.'
                dialogBody.querySelector('.tm-modal-actions')?.before(note)
            }
            return
        }
        update({ unavailable: true }, 'stays', `${tripCost(trip).stay.name} is now unavailable in this simulation. Your flights and activities are still in place.`, false)
        if (dialog.open) editOption('stays')
    }

    function submitIntent(raw) {
        const value = raw.trim().slice(0, 600)
        if (!value) return
        const message = value.toLowerCase()
        const city = message.includes('jaipur') ? 'Jaipur' : /bengaluru|bangalore/.test(message) ? 'Bengaluru' : ''
        const budgetMatch = /(?:₹\s*|\brs\.?\s*|\b(?:budget(?:\s+of)?|under|within|max(?:imum)?|total(?:\s+of)?)\s+(?:is\s+)?)([\d,]+(?:\.\d+)?)\s*(k|thousand)?/i.exec(value)
            || /\b(\d+(?:\.\d+)?)\s*(k|thousand)\b/i.exec(value)
        const budget = budgetMatch && Math.round(Number(budgetMatch[1].replaceAll(',', '')) * (budgetMatch[2] ? 1000 : 1))
        const matchPeople = /\b(\d+)\s*(?:travell?ers|people|adults|persons|of us)\b/i.exec(value)
        const perPerson = /per\s+(person|travell?er|adult)/i.test(value)
        const started = stage !== 'start'
        const ready = stage === 'ready' || stage === 'approved'
        if (!started && !matchMedia('(prefers-reduced-motion: reduce)').matches) entryComposer = composer.getBoundingClientRect()
        add('user', value)
        if (stage === 'start') stage = 'clarify'
        const party = Number(matchPeople?.[1] ?? trip.travelers)
        if (party < 1 || party > 8 || (budgetMatch && (budget < 1000 || budget * (perPerson ? party : 1) > 1000000))) {
            add('assistant', 'This demo supports 1–8 travellers and a total budget from ₹1,000 to ₹10,00,000. Which details should I use?', [['preferences', 'Edit trip details']])
            return render({ scroll: true })
        }
        if (matchPeople) trip = { ...trip, travelers: Number(matchPeople[1]), partyFixed: true }
        const mentionedOrigin = /\b(?:from|leaving)\s+(delhi|mumbai)\b/i.exec(value)
        if (!ready && mentionedOrigin) trip.origin = Object.keys(origins).find(origin => origin.toLowerCase() === mentionedOrigin[1].toLowerCase())
        if (budget >= 1000 && budget <= 1000000) trip = { ...trip, budget: budget * (perPerson ? trip.travelers : 1), budgetFixed: true }
        if (!started && /\b(?:this\s+)?weekend\b/i.test(value) && !/next\s+weekend/i.test(value)) trip.datesFixed = true
        if (perPerson && budget >= 1000 && budget <= 1000000) add('assistant', `Using ${money(trip.budget)} for the whole party based on ${money(budget)} per traveller.`)
        if (/next weekend|different dates|change (?:my |the )?dates|\b\d{4}-\d{2}-\d{2}\b/.test(message)) {
            add('assistant', 'Which departure and return dates should I use?', [['preferences', 'Edit trip details']])
            render({ scroll: true })
            return openModal('preferences')
        }
        if (/compare destinations|open to|what else|where can i go|anywhere|other destinations/.test(message)) return compareDestinations()
        if (city && (!ready || city !== trip.city)) return recommend(city)
        if (ready) {
            if (budget || matchPeople) {
                if (stage === 'approved') stage = 'ready'
                const sum = tripCost(trip).total
                add('assistant', `Updated to ${people(trip.travelers)} with a ${money(trip.budget)} total budget. The plan comes to ${money(sum)}.${sum > trip.budget ? ' See the itinerary for ways to bring the cost down.' : ''}`, planActions)
                render({ scroll: true, changed: 'preferences' })
                return
            }
            if (/stay|hotel/.test(message) && /availab|sold out/.test(message)) return showAvailability()
            if (/stay|hotel/.test(message) && /compare|swap|cheaper|change|show/.test(message)) { render({ scroll: true }); return openModal('stays') }
            if (/flight/.test(message) && /later|earlier|compare|change/.test(message)) { render({ scroll: true }); return openModal('flights') }
            if (/quiet|relax|slow down/.test(message)) return perform('quieter')
            if (/undo/.test(message)) return perform('undo')
            if (/review|book/.test(message)) { render({ scroll: true }); return openModal('review') }
            if (/date|travell?er|budget/.test(message)) { render({ scroll: true }); return openModal('preferences') }
            if (/why|reason/.test(message)) return perform('why')
            add('assistant', 'I can compare flights or stays, adjust Saturday, or update your travel dates and budget. What would help?', planActions)
        } else {
            const cue = trip.searchCity
            add('assistant', `I’m using ${trip.origin} as your starting point. ${cue ? 'Should I keep ' + cue + ' as the destination, or compare weekend trips' : 'Would you like me to compare weekend trips'} you can do for ${money(trip.budget)}? That’s the whole-trip budget for ${people(trip.travelers)}.`,
                cue ? [['choose-' + cue, 'Keep ' + cue], ['compare', 'Compare destinations']] : [['compare', 'Compare destinations']])
        }
        render({ scroll: true })
    }

    function perform(id, opener) {
        if (id.startsWith('prompt-')) return submitIntent(examples.find(([key]) => key === id.slice(7))[1])
        if (id.startsWith('map-')) return showOnMap(id.slice(4), opener)
        if (id.startsWith('jump-')) {
            const stop = id.slice(5)
            if (dialog.open) dialog.close()
            requestAnimationFrame(() => selectStop(stop, true))
            return
        }
        if (id.startsWith('day-')) {
            activeDay = id.slice(4)
            mapSelection = ''
            selectStop('')
            return refreshMap()
        }
        if (id.startsWith('move-')) {
            const [, day, order, direction] = id.split('-')
            return reorderStop(Number(day), Number(order), direction)
        }
        if (id.startsWith('replace-')) {
            const [, day, order] = id.split('-')
            replacement = { day: Number(day), order: Number(order) }
            return openModal('stop', opener)
        }
        if (id.startsWith('use-stop-') && replacement) {
            const { day, order } = replacement
            const current = tripCost(trip).days[day][order]
            const option = stopAlternatives(trip.city, current.key).find(item => item.key === id.slice(9))
            if (!option) return
            revealEditedStop(day, order)
            update({ stopOverrides: { ...trip.stopOverrides, [current.key]: option.key } }, 'activity', `Replaced ${current.title} with ${option.title}.`)
            closeModal()
            selectStop(changedStop, true)
            return
        }
        if (id.startsWith('choose-')) {
            const city = id.slice(7)
            add('user', 'Plan the weekend in ' + city)
            return recommend(city)
        }
        if (id.startsWith('preview-')) {
            compareChoice = id.slice(8)
            renderModal()
            dialog.querySelector('[data-action=apply]').focus()
            return
        }
        switch (id) {
            case 'toggle-airport':
                airportVisible = !airportVisible
                if (!airportVisible && mapSelection === 'airport') mapSelection = ''
                return refreshMap()
            case 'compare': return compareDestinations()
            case 'stays':
            case 'flights': return editOption(id, opener)
            case 'review':
                if (modal === 'view') modalTrail.push('view')
                return openModal(stage === 'approved' ? 'approved' : 'review', opener)
            case 'view':
            case 'preferences':
                if (planningStages.includes(modal)) modalTrail.push(modal)
                return openModal(id, opener)
            case 'availability': return showAvailability()
            case 'apply': return applyOption()
            case 'close': return closeModal()
            case 'history': return openModal('history', opener)
            case 'chat':
                modalTrail.length = 0
                return closeModal()
            case 'why':
                add('assistant', planReason() + ' The estimate includes flights, a stay, and activities. Meals and local transport are separate.')
                return render({ scroll: true })
            case 'quieter': return suggestQuiet()
            case 'apply-quiet': {
                if (!quietProposal) return
                const cost = tripCost({ ...trip, ...quietProposal })
                revealEditedStop(0, cost.days[0].length - 1)
                update(quietProposal, 'activity', `Saturday updated. ${cost.days[0].at(-1).title} is on the map. New total ${money(cost.total)}.`)
                selectStop(changedStop, true)
                return
            }
            case 'cancel-quiet':
                if (!quietProposal) return
                quietProposal = null
                removeActions(['apply-quiet', 'cancel-quiet'])
                add('assistant', 'Kept your current Saturday plan.', [], 'day-0')
                return render({ scroll: true })
            case 'undo':
                if (!undo) {
                    add('assistant', 'There’s no recent change to undo.')
                    return render({ scroll: true })
                }
                return update(undo.fields, undo.changed, `Previous choice restored. Your total is ${money(tripCost({ ...trip, ...undo.fields }).total)}.`, false)
            case 'approve':
                if (trip.unavailable || tripCost(trip).total > trip.budget) return
                stage = 'approved'
                modalTrail.length = 0
                add('assistant', `Approved. Your ${trip.city} trip for ${people(trip.travelers)} is estimated at ${money(tripCost(trip).total)}.`)
                render({ scroll: true })
                return openModal('approved')
            case 'reset':
                trip = initialTrip()
                stage = 'start'
                messages = []
                undo = null
                quietProposal = null
                changedStop = ''
                input.value = ''
                render()
                return input.focus()
        }
    }

    const spoken = new Set(['quieter', 'why', 'compare', 'apply-quiet', 'cancel-quiet', 'undo'])
    root.addEventListener('click', event => {
        const button = event.target.closest('[data-action]')
        if (!button) return
        if (button.closest('[data-note]') && spoken.has(button.dataset.action)) add('user', button.textContent.trim())
        perform(button.dataset.action, button)
    })
    composer.addEventListener('submit', event => {
        event.preventDefault()
        if (!input.value.trim() && (stage === 'ready' || stage === 'approved')) {
            add('assistant', 'What would you like to change in this itinerary?', planActions)
            render({ scroll: true })
            return
        }
        submitIntent(input.value)
        input.value = ''
    })
    originContext.addEventListener('change', () => {
        trip.origin = originContext.value
    })
    cityContext.addEventListener('change', () => {
        trip.searchCity = cityContext.value
        trip.city = cityContext.value || 'Bengaluru'
    })
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault()
            composer.requestSubmit()
        }
    })
    dialog.addEventListener('submit', event => {
        event.preventDefault()
        const values = new FormData(event.target)
        const start = values.get('start')
        const end = values.get('end')
        if (Date.parse(end) - Date.parse(start) !== night || new Date(start).getUTCDay() !== 6) {
            event.target.querySelector('[data-form-error]').textContent = 'Choose a Saturday departure and return the following Sunday.'
            return
        }
        const travelers = Number(values.get('travelers'))
        const budget = Number(values.get('budget'))
        update({ start, end, travelers, budget, datesFixed: true, partyFixed: true, budgetFixed: true }, 'preferences',
            `Updated to ${dateRange({ start, end })}, ${people(travelers)}, with a ${money(budget)} total budget.`, false)
        closeModal()
    })
    dialog.addEventListener('cancel', event => {
        if (!modalTrail.length) return
        event.preventDefault()
        closeModal()
    })
    dialog.addEventListener('close', () => {
        modal = ''
        modalTrail.length = 0
        if (mapPanel.parentElement !== mapDock) mapDock.append(mapPanel)
        const opener = [...root.querySelectorAll('[data-action]')].find(button => button.dataset.action === restoreAction && button.getClientRects().length && !dialog.contains(button))
        const destination = opener || input
        destination.focus({ preventScroll: true })
    })
    render()
    const viewport = window.visualViewport
    const syncViewport = () => root.style.setProperty('--tm-viewport', `${Math.round(viewport.height)}px`)
    viewport?.addEventListener('resize', syncViewport)
    if (viewport) syncViewport()
    return () => {
        viewport?.removeEventListener('resize', syncViewport)
        map?.destroy()
    }
}

export default {
    name: 'Travemore',
    mounted() {
        this.disposePlanner = mountPlanner(this.refs.planner)
    },
    beforeDestroy() { this.disposePlanner?.() },
    template() { return `
        <div class="tm" data-stage="start" ref="planner">
            <header class="tm-top"><div class="tm-top-inner">
                <a class="tm-brand" href="/inspiration" aria-label="MakeMyTrip planning home">make<em>my</em>trip</a>
                <span class="tm-product">Travemore</span>
                <nav aria-label="Travemore">
                    <button type="button" class="tm-btn tm-btn-plain tm-btn-small tm-history-button" data-action="history" aria-label="Conversation" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5c-4.7 0-8.5 3.1-8.5 7 0 2 1 3.8 2.7 5.1l-.7 3 3.4-1.7c1 .4 2 .6 3.1.6 4.7 0 8.5-3.1 8.5-7s-3.8-7-8.5-7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><b>Conversation</b><span class="tm-count">0</span></button>
                    ${action('reset', 'New trip', 'tm-btn tm-btn-plain tm-btn-small')}
                </nav>
            </div></header>
            <main class="tm-main">
                <section class="tm-doc" aria-label="Trip plan">
                    <div class="tm-intro">
                        <h1>Plan a weekend.</h1>
                        <p>Say what you have in mind. Travemore puts flights, a stay and things to do into one plan you can change.</p>
                    </div>
                    <div class="tm-sheet"></div>
                    <div class="tm-dock">
                        <form class="tm-composer"><label class="tm-sr" for="tm-intent">Message Travemore</label><textarea id="tm-intent" name="intent" rows="1" maxlength="600" placeholder="A weekend away, a place, or a budget…"></textarea><button class="tm-send" type="submit" aria-label="Send">${glyph.send}</button></form>
                        <div class="tm-context" role="group" aria-label="Search context">
                            <label class="tm-select"><span class="tm-sr">Departure city</span><select id="tm-search-origin"><option value="Delhi">From Delhi</option><option value="Mumbai">From Mumbai</option></select></label>
                            <label class="tm-select"><span class="tm-sr">Destination from your recent search</span><select id="tm-search-city"><option value="Bengaluru">Bengaluru · recent search</option><option value="Jaipur">Jaipur · recent search</option><option value="">No destination yet</option></select></label>
                        </div>
                        <div class="tm-dock-actions"><div class="tm-view-trip"></div><div class="tm-review-slot"></div></div>
                    </div>
                    <div class="tm-start-more">
                        <section class="tm-group"><header class="tm-group-head"><h3>Try asking</h3></header>
                            <ul class="tm-list">${examples.map(([id, label]) => `<li><button type="button" class="tm-row tm-row-link" data-action="prompt-${id}"><span class="tm-row-text"><strong>${label}</strong></span>${glyph.chevron}</button></li>`).join('')}</ul>
                        </section>
                        <section class="tm-group"><header class="tm-group-head"><h3>Or start from a guide</h3></header>
                            <ul class="tm-list">${indiaGuides.map(guide => `<li><a class="tm-row tm-row-link" href="${guide.link}"><img class="tm-thumb" src="${guide.cover}" alt="" loading="lazy"><span class="tm-row-text"><strong>${guide.title}</strong><small>${guide.tag}</small></span>${glyph.chevron}</a></li>`).join('')}</ul>
                        </section>
                    </div>
                </section>
                <div class="tm-map-dock">
                    <section class="tm-map-pane" aria-label="Trip map">
                        <div class="tm-map-canvas"></div>
                        <div class="tm-map-bar">
                            <div class="tm-segmented" role="group" aria-label="Show day on map">
                                <button data-action="day-all" data-map-day="all" type="button" aria-pressed="true">Both days</button>
                                <button data-action="day-0" data-map-day="0" type="button" aria-pressed="false">Sat</button>
                                <button data-action="day-1" data-map-day="1" type="button" aria-pressed="false">Sun</button>
                            </div>
                            ${action('toggle-airport', 'Airport', 'tm-map-toggle')}
                        </div>
                        <div class="tm-map-detail" role="status"></div>
                    </section>
                </div>
            </main>
            <div class="tm-sr tm-announcer" role="status" aria-atomic="true"></div>
            <dialog class="tm-dialog" aria-labelledby="tm-modal-title"><div class="tm-dialog-body"></div></dialog>
        </div>
    ` },
}
