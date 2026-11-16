import { indiaGuides } from '../indiaGuides.js'
import { budgetOptions } from '../studentBudget.js'
import { replacementPlaces } from '../replacementPlaces.js'
import { lodgingFor } from '../lodgingOptions.js'
import ItineraryMap from './ItineraryMap.tiny.js'
import { itineraryDayColors } from '../itineraryRoutes.js'
import '../tokens.css'
import '../guides.css'

const photoGalleries = {
    jaipur: [['jaipur.jpg','Hawa Mahal'],['jaipur-amer.jpg','Amer Fort'],['jaipur-palace.jpg','City Palace']],
    ahmedabad: [['ashram.webp','Sabarmati Ashram'],['mosque.webp','Sidi Saiyyed Mosque'],['lake.webp','Kankaria Lake']],
    hampi: [['hampi.jpg','Virupaksha Temple'],['hampi-vittala.jpg','Vittala Temple'],['hampi-achyutaraya.jpg','Achyutaraya Temple']],
}
const destinationNotes = {
    jaipur: ['Jaipur’s walled city is easiest to explore in clusters. Start with the royal quarter, save a separate day for Amer, and leave time for the bazaars.','Hindi and Rajasthani varieties are commonly spoken.','Jaipur International Airport and Jaipur Junction.','Cooler months make the fort climbs and market walks more comfortable.'],
    ahmedabad: ['Ahmedabad’s old city and the Sabarmati riverfront tell different parts of the city’s story. Pair short walking routes with an auto ride for longer cross-city legs.','Gujarati and Hindi are commonly spoken.','Sardar Vallabhbhai Patel International Airport and Ahmedabad Junction.','Choose cooler months for longer walks through the pols and riverfront.'],
    hampi: ['Hampi’s monuments sit in separate clusters across a rocky landscape. Give each cluster its own morning and allow a break in the heat of the day.','Kannada is the principal local language.','Hospet Junction is the nearby rail hub. Check schedules if flying via Vidyanagar or Hubballi.','Cooler months and early mornings suit the exposed temple walks.'],
}
const homeHeadline = 'A few days away.'
const planningBudgets = [
    {value:'under-800',label:'Under ₹800'},
    {value:'800-1500',label:'₹800–1,500'},
    {value:'1500-2500',label:'₹1,500–2,500'},
]
const profileQuestions = {
    interests: {text:'What would you most like to do?', options:['History and culture','Food and markets','Outdoors and views','A bit of everything'],next:'pace'},
    pace: {text:'What pace works for your group?', options:['Relaxed, less walking','Balanced','Packed days'],next:'diet'},
    diet: {text:'Any food preferences?', options:['Vegetarian','Vegan','No preference','Skip for now'],next:'stayType'},
    stayType: {text:'What kind of place would you like to stay in?',options:['Hostel dorm','Private hostel room','Guesthouse','Budget hotel','Show me the best value'],next:'sharing'},
    sharing: {text:'How should we estimate beds or rooms for your group?',options:['Share twin rooms','One private room each','Dorm beds are fine'],next:'stayPriority'},
    stayPriority: {text:'What matters most in your stay?',options:['Lowest cost','Quiet and privacy','Social common areas','No preference'],next:'transport'},
    transport: {text:'How would you prefer to get around?',options:['Walk and use public transport','Split autos or taxis','Mix of both'],next:'swap'},
    swap: {text:'Would you like to replace one stop with a suggested alternative?',options:[],next:'dates'},
}
const emptyTrip = () => ({destination:'',start:'',end:'',travelers:1,budget:''})
function readLocal(key,fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
    catch { return fallback }
}

const placeCard = (item, loop, open, {stay=false, editable=false}={}) => {
    const isSample = stay ? 'true' : item+'.mock'
    const label = item+'.kind'
    const note = item+'.note'
    return /*html*/`
        <article class="guide-place-card reference-place-card" x-for="${loop}" :key="${item}.title">
            <button class="place-card-image place-card-open" type="button" @click="${open}" :aria-label="'View details for '+${item}.title">
                <img :src="cardPhoto(${item}.title).src" :alt="cardPhoto(${item}.title).alt" loading="lazy">
                <span x-if="cardPhoto(${item}.title).placeholder" class="place-card-photo-credit">Placeholder photo</span>
            </button>
            <div class="guide-place-copy">
                <h4>{{ ${item}.title }}</h4>
                <p class="guide-place-meta">{{ ${label} }} <span x-if="${item}.time"> · {{ ${item}.time }} · {{ ${item}.duration }}</span><span x-if="${item}.price"> · {{ ${item}.price }}</span></p>
                <p x-if="${isSample}" class="guide-place-meta">★ {{ ${item}.rating }} · {{ ${item}.reviews }} sample reviews</p>
                <p x-if="${item}.estimate" class="guide-place-meta">${'{{ '+item+'.estimate }}'}</p>
                <p x-if="${item}.recommended" class="guide-place-flag">Recommended for your preferences</p>
                <p x-if="${item}.higherSpend" class="guide-place-meta">Takes a larger share of your daily budget</p>
                <p class="place-tip-heading">{{ ${isSample} ? 'Planning note' : 'Insider tip' }}</p>
                <p class="place-tip">{{ ${note} }}</p>
                <div class="place-card-actions">
                    <button class="link-button" type="button" @click="${open}">View details</button>
                    ${editable ? '<button class="link-button" type="button" @click="editStop(stop,index,stopIndex)">Edit</button>' : ''}
                    <span class="place-card-icons">
                        <button class="icon-button" type="button" @click="toggleCardSaved(${item})" :aria-pressed="cardSaved(${item})" :aria-label="'Save '+${item}.title">{{ cardSaved(${item}) ? '♥' : '♡' }}</button>
                        <button class="icon-button" type="button" @click="addCardToTrip(${item})" :aria-label="'Add '+${item}.title+' to trip'">＋</button>
                    </span>
                </div>
            </div>
        </article>`
}

export default {
    name:'IndiaInspiration',
    components:{'itinerary-map':ItineraryMap},
    data() {
        const slug=location.pathname.split('/').filter(Boolean)[1]
        const stored=readLocal('india-guide-'+slug,null)
        const guide=stored || indiaGuides.find(item=>item.id===slug)
        return {guide,homeHeadline,groqAdvice:guide ? readLocal('india-groq-plan-'+guide.id,'') : '',photoIndex:0,readMore:false,saved:readLocal('india-saved-'+slug,false),shareStatus:'',stickyShareOpen:false,kindMenu:'',placeDetails:null,placeTab:'Overview',placeShare:'',placePhotoIndex:0,placeGalleryOpen:false,savedPlaces:readLocal('india-saved-places',[]),mapReset:0,mapLayers:false,mapLight:false,category:'all',query:'',prompt:'',guideChatStep:'',guideEditMode:'',guideEditDay:0,guideEditStatus:'',homeStep:'',homeMessages:[],homeInput:'',homeError:'',homeDraft:null,groqConfigured:false,groqCanConnect:true,groqSetup:false,groqKey:'',groqError:'',groqBusy:false,groqConnecting:false,groqPending:'',manualOpen:false,trip:readLocal('india-trip',emptyTrip()),sidebarCollapsed:false,edit:null,activeDay:-1,tab:'overview',contents:0,selected:null,mobileMap:false}
    },
    mounted() {
        void this.loadGroqStatus()
        const guide=this.data.guide.value
        const params=new URLSearchParams(location.search)
        if (!guide && params.has('plan')) {
            this.startGuideChat(params.get('plan'))
            return
        }
        const title=params.get('place')
        if (!guide || !title) return
        for (const [day,entry] of guide.days.entries()) {
            const place=[...entry.stops,...this.foodForDay(day)].find(item=>item.title===title)
            if(place) { this.openPlace(place,day); return }
        }
        const stay=this.budget().stays.find(item=>item.title===title)
        if(stay) this.openStay(stay)
    },
    template() { return /*html*/`
    <main class="dashboard india-shell" :data-page="guide ? 'guide' : 'home'" :class="{ 'india-detail': guide, 'india-sidebar-collapsed': sidebarCollapsed, 'rail-collapsed': sidebarCollapsed }">
        <header class="india-mobile-heading"><a href="/inspiration" aria-label="MakeMyTrip prototype home" class="mmt-brand"><span>make</span><em>my</em><span>trip</span></a></header>
        <button x-if="guide" class="india-rail-arrow" type="button" @click="toggleSidebar" :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'" :aria-expanded="!sidebarCollapsed" aria-controls="india-sidebar">{{ sidebarCollapsed ? '›' : '‹' }}</button>
        <aside id="india-sidebar" class="home-sidebar" aria-label="Navigation">
            <a class="home-brand mmt-brand" href="/inspiration" aria-label="MakeMyTrip planning home"><span>make</span><em>my</em><span>trip</span></a>
            <nav class="source-list" aria-label="Planner"><a href="/inspiration"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/></svg>Plan a weekend</a></nav>
            <p class="source-heading">Guides</p>
            <nav class="source-list" aria-label="Guides"><a x-for="item in allGuides()" :key="item.id" :href="item.link" :class="{ 'india-current': guide && guide.id === item.id }" :aria-current="guide && guide.id === item.id ? 'page' : 'false'"><img :src="item.cover" alt="">{{ item.location.split(',')[0] }}</a></nav>
        </aside>
        <section x-if="!guide" class="workspace-page inspiration-page india-list">
            <div class="trip-hero">
            <div class="trip-hero-content">
            <h1 class="home-title">{{ homeHeadline }}</h1>
            <p x-if="!homeStep" class="india-home-intro">Tell us where you’d like to go and what you want to spend. We’ll help you shape a trip you can make your own.</p>
            <section class="home-trip-chat" :class="{ 'is-open': homeStep }" aria-label="Trip planning chat">
                <div class="home-chat-reveal"><div class="home-chat-clip">
                    <header x-if="homeStep" class="home-trip-chat-header"><strong>Personalize your trip</strong><button type="button" class="round-button" @click="closeHomeChat" aria-label="Close planning chat">×</button></header>
                    <div x-if="homeStep" class="home-trip-thread" ref="homeThread" role="log" aria-live="polite">
                        <p x-for="(message,index) in homeMessages" :key="index" class="home-trip-message" :class="message.role">{{ message.text }}</p>
                        <div x-if="homeStep === 'city'" class="home-trip-choices"><button x-for="city in homeCities()" :key="city" type="button" class="india-pill" @click="pickHomeCity(city)">{{ city }}</button></div>
                        <div x-if="homeStep === 'budget'" class="home-trip-choices"><button x-for="option in budgetChoices()" :key="option.value" type="button" class="india-pill" @click="pickHomeBudget(option.value)">{{ option.label }}</button></div>
                        <div x-if="homeStep === 'people'" class="home-trip-choices"><button x-for="count in homePeopleOptions()" :key="count" type="button" class="india-pill" @click="pickHomePeople(count)">{{ count }}</button></div>
                        <div x-if="profileQuestion()" class="home-trip-choices"><button x-for="option in profileQuestion().options" :key="option" type="button" class="india-pill" @click="pickProfileAnswer(option)">{{ option }}</button></div>
                        <form x-if="homeStep === 'dates'" class="home-trip-dates" @submit-prevent="finishHomeDates">
                            <label>Start date<input type="date" x-model="homeDraft.start" required></label><label>End date<input type="date" x-model="homeDraft.end" :min="homeDraft.start" required></label>
                            <button class="button-primary" type="submit">Use dates</button><button class="button-secondary" type="button" @click="skipHomeDates">Decide later</button>
                        </form>
                        <form x-if="groqSetup" class="groq-setup" @submit-prevent="connectGroq"><label>Groq API key<input type="password" x-model="groqKey" autocomplete="off" required placeholder="gsk_…"></label><button class="button-primary" type="submit" :disabled="groqConnecting">Connect</button><button class="button-secondary" type="button" @click="closeGroqSetup">Cancel</button></form>
                        <p x-if="groqBusy" role="status">Groq is working on your plan…</p>
                        <p x-if="groqError" class="home-trip-error" role="alert">{{ groqError }}</p>
                        <p x-if="homeError" class="home-trip-error" role="alert">{{ homeError }}</p>
                    </div>
                </div></div>
                <div x-if="homeStep === 'done'" class="home-trip-choices home-chat-actions">
                    <a class="home-primary home-trip-link" :href="homeGuideLink()">Click here to see your stitched itinerary</a>
                    <button class="india-pill" type="button" @click="resetHomeChat">Start over</button>
                    <button x-if="!groqConfigured && groqCanConnect" class="india-pill" type="button" @click="showGroqSetup">Connect Groq</button>
                    <button x-if="groqConfigured && !groqBusy && groqError" class="india-pill" type="button" @click="retryGroq">Try again</button>
                </div>
                <button x-if="!homeStep" class="home-primary home-chat-start" type="button" @click="resetHomeChat">Plan with AI</button>
                <form x-if="homeStep && homeStep !== 'dates'" class="india-chat-input home-trip-composer" @submit-prevent="submitHomeChat">
                    <input x-model="homeInput" :placeholder="homeChatPlaceholder()" aria-label="Ask the travel assistant" :disabled="homeStep === 'dates' || groqBusy">
                    <button type="submit" :disabled="groqBusy" aria-label="Send answer">↑</button>
                </form>
            </section>
            </div>
            <div class="trip-hero-photo">
                <img src="/discovery/jaipur-amer.jpg" alt="The painted gateway at Amer Fort in Jaipur" width="824" height="870" fetchpriority="high">
            </div>
            </div>
            <div class="trip-guide-heading">
                <h2>Trip inspiration in India</h2>
                <label class="workspace-search india-guide-search"><input x-model="query" placeholder="Find a guide" aria-label="Search destinations in India"><span aria-hidden="true">⌕</span></label>
            </div>
            <p x-if="!visibleGuides().length" role="status">No guides match your search.</p>
            <div class="inspiration-grid india-grid">
                <article class="inspiration-card" x-for="item in visibleGuides()" :key="item.id">
                    <div class="discovery-cover"><a :href="item.link" :aria-label="item.title"><img :src="item.cover" alt=""></a><span class="discovery-count">{{ item.count }} places</span></div>
                    <a class="discovery-title" :href="item.link">{{ item.title }}</a>
                    <p>{{ item.location }}</p><p>{{ item.tag }}</p>
                </article>
            </div>
        </section>
        <section x-if="guide" class="guide-page india-guide" :class="{ 'india-show-map': mobileMap }">
            <article class="guide-content">
                <header class="guide-hero" @touchstart="startSwipe($event)" @touchend="endSwipe($event)">
                    <img class="guide-cover-photo" @load="revealCover($event)" :src="currentPhoto().src" :alt="currentPhoto().label">
                    <div class="guide-toolbar"><button class="cover-contents-toggle" type="button" @click="toggleContents" :aria-expanded="contents === 1" aria-controls="cover-contents" aria-label="Table of contents"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.4M4 12h.4M4 18h.4"></path></svg></button>
                        <div>
                            <button type="button" @click="toggleSaved" :aria-pressed="saved">{{ saved ? '♥ Saved' : '♡ Save' }}</button>
                            <button type="button" @click="openManual">＋ Add to trip</button>
                            <button class="india-map-toggle" type="button" @click="openMap">Map</button>
                        </div>
                    </div>
                    <button class="guide-photo-arrow previous" type="button" @click="previousPhoto" aria-label="Previous photo">‹</button>
                    <button class="guide-photo-arrow next" type="button" @click="nextPhoto" aria-label="Next photo">›</button>
                    <nav x-if="contents === 1" id="cover-contents" class="india-contents" aria-label="Table of contents">
                        <button x-for="(day,index) in guide.days" :key="day.title" type="button" @click="jumpDay(index)">Day {{ index + 1 }} · {{ day.title }}</button>
                        <button type="button" @click="jumpStay">Where to stay</button><button type="button" @click="jumpFood">Food and drinks</button><button type="button" @click="jumpShopping">Shopping</button>
                    </nav>
                    <div class="guide-heading"><h1>{{ guide.title }}</h1><p class="guide-location">{{ guide.location }}</p><button type="button" class="home-primary" @click="openGuidePlanner">Plan a trip</button></div>
                    <div class="guide-photo-dots" aria-label="Cover photos"><button x-for="(photo,index) in photos()" :key="photo.src" type="button" @click="selectPhoto(index)" :aria-label="'Show photo of '+photo.label" :aria-pressed="photoIndex === index"></button></div>
                </header>
                <div class="guide-body">
                    <div class="guide-sticky"><div class="guide-sticky-top"><button type="button" @click="toggleStickyContents" :aria-expanded="contents === 2" aria-controls="sticky-contents" aria-label="Guide sections"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.4M4 12h.4M4 18h.4"></path></svg></button><strong>{{ guide.title }}</strong><button class="india-pill" type="button" @click="openGuidePlanner">Plan a trip</button><button type="button" @click="toggleSaved" :aria-pressed="saved" aria-label="Save guide">{{ saved ? '♥' : '♡' }}</button><button type="button" @click="openManual" aria-label="Add guide to trip">＋</button><button type="button" @click="toggleStickyShare" aria-label="Share this guide">↗</button></div>
                    <nav x-if="contents === 2" id="sticky-contents" class="sticky-guide-menu" aria-label="Guide sections"><button x-for="(day,index) in guide.days" :key="day.title" type="button" @click="jumpDay(index)">Day {{ index+1 }} · {{ day.title }}</button><button type="button" @click="jumpStay">Budget stays</button><button type="button" @click="jumpFood">Food and drinks</button><button type="button" @click="jumpShopping">Shopping</button></nav>
                    <div x-if="stickyShareOpen" class="sticky-guide-menu sticky-share" role="menu" aria-label="Guide sharing"><button type="button" role="menuitem" @click="shareGuide">Copy link</button></div>
                    <p x-if="shareStatus" class="sticky-link-status" role="status">{{ shareStatus }}</p>
                    <nav class="workspace-tabs" aria-label="Guide views"><button type="button" :class="{current: tab === 'overview'}" @click="showOverview">Overview</button><button type="button" :class="{current: tab === 'places'}" @click="showPlaces">Places</button></nav></div>
                    <section x-if="tab === 'overview'">
                        <details x-if="groqAdvice" class="india-optional"><summary>Personalized planning suggestions</summary><p class="groq-reply">{{ groqAdvice }}</p></details><div class="guide-introduction"><p x-if="guidePreferences()" class="guide-trip-preferences">{{ guidePreferences() }}</p><p class="india-intro">{{ guide.intro }}</p><p x-if="readMore">{{ travelNotes()[0] }}</p><button class="india-pill" type="button" @click="toggleIntro" :aria-expanded="readMore">{{ readMore ? 'Read less' : 'Read more' }}</button></div><section class="guide-place-shortcuts"><h2>Places and experiences</h2><div><button type="button" @click="toggleStopMenu" :aria-expanded="kindMenu === 'stops'">{{ guide.count }} attractions and stops</button><button type="button" @click="toggleFoodMenu" :aria-expanded="kindMenu === 'food'">{{ mealCount() }} budget food spots</button><button type="button" @click="toggleStaysMenu" :aria-expanded="kindMenu === 'stays'">Budget stays</button></div>
                        <section x-if="kindMenu" class="guide-category-popover" role="dialog" aria-label="Places in this category">
                            <header><strong>{{ categoryTitle() }}</strong><button type="button" @click="closeCategory" aria-label="Close category">×</button></header>
                            <button x-for="row in categoryRows()" :key="row.place.title" type="button" @click="pickCategory(row)"><strong>{{ row.place.title }}</strong><small>{{ row.place.kind || row.place.price }}</small></button>
                        </section>
                    </section><section class="student-budget" id="guide-budget"><h2>Budget stays</h2><p>Example venues, rupee estimates and mock ratings for the prototype. These are not Google reviews.</p>${placeCard("stay","stay in budget().stays","openStay(stay)",{stay:true})}<p><strong>Getting around on a budget</strong><br>{{ budget().transport }}</p></section>
                        <section class="india-day" x-for="(day,index) in guide.days" :key="day.title" :id="'day-'+index" :style="'--day:'+dayColor(index)">
                            <p class="india-day-label">Day {{ index+1 }}</p>
                            <div class="india-day-heading"><h2>{{ day.title }}</h2><button type="button" @click="showDay(index)" :aria-pressed="activeDay === index">Show day on map</button></div>
                            <details class="india-optional"><summary>Day overview</summary><p>{{ day.description }}</p></details><p x-if="personalizedDayNote(day,index)" class="personalized-day-note">{{ personalizedDayNote(day,index) }}</p>
                            <div class="guide-place-list">${placeCard("stop","(stop,stopIndex) in day.stops","openPlace(stop,index)",{editable:true})}</div>
                            <details class="india-optional"><summary>Getting around</summary><p>{{ day.travel }}</p></details><section class="student-food"><h3>Budget food nearby</h3>${placeCard("meal","meal in foodForDay(index)","openPlace(meal,index)")}</section>
                        </section>
                        <section class="india-guide-notes"><details class="india-optional" id="guide-stay"><summary>Where to stay</summary><p>{{ guide.stay }}</p></details><details class="india-optional" id="guide-food"><summary>Food and drinks</summary><p>{{ guide.food }}</p></details><details class="india-optional" id="guide-shopping"><summary>Shopping</summary><p>{{ guide.shopping }}</p></details><a :href="guide.source" target="_blank" rel="noopener">Destination reference ↗</a></section>
                    </section>
                    <section x-if="tab === 'places'" class="india-places">
                        <section x-if="category === 'all'" class="guide-context">
                            <img class="guide-context-photo" :src="guide.cover" :alt="guide.location">
                            <section><h2>A little bit of context to start with</h2><p>{{ travelNotes()[0] }}</p></section>
                            <section><h2>Language</h2><p>{{ travelNotes()[1] }}</p></section>
                            <section><h2>Currency</h2><p>Indian rupee (INR)</p></section>
                            <section><h2>Getting there</h2><p>{{ travelNotes()[2] }}</p></section>
                            <section><h2>Best time to visit</h2><p>{{ travelNotes()[3] }}</p></section>
                        </section>
                        <h2>Places and experiences</h2>
                        <div class="guide-place-filters"><button class="india-pill" type="button" :aria-pressed="category === 'all'" @click="showPlaces">All</button><button class="india-pill" type="button" :aria-pressed="category === 'stops'" @click="showAttractions">Itinerary stops</button><button class="india-pill" type="button" :aria-pressed="category === 'food'" @click="showFoodPlaces">Budget food</button></div>
                        <section x-for="(day,index) in guide.days" :key="day.title" class="places-day"><p class="places-day-number">Day {{ index + 1 }}</p><h3>{{ day.title }}</h3><p>{{ day.description }}</p>
                            <div class="guide-place-list">${placeCard("place","place in placesForDay(day,index)","openPlace(place,index)")}</div>
                        </section>
                        <section x-if="category === 'all'" class="places-stays" id="places-stays"><h2>Budget stays</h2>${placeCard("stay","stay in budget().stays","openStay(stay)",{stay:true})}</section></section>
                </div>
                <div class="guide-edit-chat">
                    <section x-if="guideChatStep" class="guide-chat-options" aria-label="Itinerary editing chat">
                        <header><strong>Change your itinerary</strong><button class="round-button" type="button" @click="closeGuideChat" aria-label="Close itinerary chat">×</button></header>
                        <div class="guide-chat-questions" aria-live="polite">
                            <p x-if="guideEditStatus" class="guide-chat-confirmation">{{ guideEditStatus }}</p>
                            <div x-if="guideChatStep === 'action'"><p>What would you like to change?</p>
                                <div class="home-trip-choices"><button class="india-pill" type="button" @click="chooseGuideEdit('place')">Replace a place</button><button class="india-pill" type="button" @click="chooseGuideEdit('time')">Change time or duration</button><button class="india-pill" type="button" @click="chooseGuideEdit('notes')">Edit notes</button></div>
                            </div>
                            <div x-if="guideChatStep === 'day'"><p>Which day would you like to edit?</p>
                                <div class="home-trip-choices"><button x-for="(day,index) in guide.days" :key="index" class="india-pill" type="button" @click="chooseGuideEditDay(index)">Day {{ index+1 }}</button></div>
                                <button class="guide-chat-back" type="button" @click="showGuideEditActions">Back</button>
                            </div>
                            <div x-if="guideChatStep === 'stop'"><p>Which stop on Day {{ guideEditDay+1 }}?</p>
                                <div class="home-trip-choices"><button x-for="(stop,index) in guide.days[guideEditDay].stops" :key="index" class="india-pill" type="button" @click="editFromGuideChat(index)">{{ stop.title }}</button></div>
                                <button class="guide-chat-back" type="button" @click="showGuideEditDays">Back</button>
                            </div>
                        </div>
                    </section>
                    <form class="india-chat-input guide-composer" @submit-prevent="openChat"><input x-model="prompt" placeholder="Ask to edit this itinerary…" aria-label="Ask to edit this itinerary"><button type="submit" aria-label="Open itinerary editing chat">↑</button></form>
                </div>
            </article>
            <aside class="india-map-panel" :class="{ 'map-light': mapLight, 'has-place-details': placeDetails }" aria-label="Itinerary map and place details">
                <itinerary-map :days="guide.days" :meals="budget().meals" :active-day="activeDay" :selected="selected" :reset-key="mapReset"></itinerary-map>
                <div class="india-map-controls"><button type="button" @click="showAll" :aria-pressed="activeDay === -1">All days</button><button x-for="(day,index) in guide.days" :key="day.title" type="button" @click="filterDay(index)" :aria-pressed="activeDay === index">Day {{ index+1 }}</button><button class="india-map-toggle" type="button" @click="closeMap">Itinerary</button></div>
                <div class="guide-map-utilities"><button type="button" @click="fitMap" aria-label="Fit map to stops">⌖</button><button type="button" @click="toggleMapLayers" :aria-expanded="mapLayers" aria-label="Change map display type">▱</button>
                    <div x-if="mapLayers" class="guide-map-style"><button type="button" @click="useDarkMap" :aria-pressed="!mapLight">Higher contrast</button><button type="button" @click="useLightMap" :aria-pressed="mapLight">Soft map</button></div></div>
                <div class="india-map-caption"><div class="map-day-legend" aria-label="Itinerary colors"><span x-for="(day,index) in guide.days" :key="day.title" :class="'map-day-'+index"><i></i>Day {{ index+1 }}</span></div><p>Numbered stops · Food pins are prototype venues</p></div>
                <section x-if="placeDetails" class="guide-detail-panel" role="region" aria-label="Place details">
                    <header class="place-panel-header"><button type="button" @click="returnToMap" aria-label="Close place details">×</button><div><button class="india-pill" type="button" @click="togglePlaceSaved" :aria-pressed="placeSaved()">{{ placeSaved() ? '♥ Saved' : '♡ Save' }}</button><button class="india-pill" type="button" @click="addPlaceToTrip">＋ Add to trip</button><button class="india-pill" type="button" @click="sharePlace" aria-label="Share place">↗</button></div></header><p x-if="placeShare" class="place-share-status" role="status">{{ placeShare }}</p>
                    <div class="place-panel-title"><h2>{{ placeDetails.place.title }}</h2><p>{{ placeDetails.place.kind }} · {{ guide.location }} <span x-if="placeDetails.place.mock"> · Prototype example</span></p></div>
                    <nav class="workspace-tabs place-panel-tabs" aria-label="Place details tabs"><button x-for="name in detailTabs()" :key="name" type="button" :class="{current: placeTab === name}" @click="setPlaceTab(name)">{{ name }}</button></nav>
                    <div class="place-panel-body">
                        <section x-if="placeTab === 'Overview'">
                            <div x-if="placeGallery().length" class="place-panel-gallery"><button x-for="(photo,index) in placeGallery()" :key="photo.src" type="button" @click="openPlaceGallery(index)" :aria-label="'Open photo of '+photo.label"><img :src="photo.src" :alt="photo.label"></button></div>
                            <p>{{ placeDetails.place.note }}</p><p x-if="placeDetails.place.estimate">{{ placeDetails.place.estimate }}</p><p x-if="placeDetails.place.duration">Suggested visit · {{ placeDetails.place.duration }}</p><p x-if="placeDetails.place.price">Estimated cost · {{ placeDetails.place.price }}</p>
                            <button x-if="placeDetails.day >= 0" class="india-pill" type="button" @click="placeOnMap">Show on map</button>
                            <details class="india-optional"><summary>How does this fit into the trip?</summary><p>{{ placePlanNote() }}</p></details>
                            <button class="india-pill" type="button" @click="askAboutPlace">Ask TravelMore about this place</button>
                        </section>
                        <section x-if="placeTab === 'Guides'"><h3>Guides that mention {{ placeDetails.place.title }}</h3><button class="place-guide-link" type="button" @click="jumpToPlaceDay"><img :src="guide.cover" alt=""><strong>{{ guide.title }}</strong><small>{{ guide.location }}</small></button></section>
                        <section x-if="placeTab === 'Activities'"><h3>Nearby stops in this itinerary</h3><p x-if="!relatedStops().length">See the full itinerary for things to do.</p><button x-for="stop in relatedStops()" :key="stop.title" class="place-related-stop" type="button" @click="openRelated(stop)"><strong>{{ stop.title }}</strong><small>{{ stop.duration }}</small></button></section>
                        <section x-if="placeTab === 'Reviews'"><h3>Reviews</h3><div x-if="placeDetails.place.mock" class="sample-review"><span>Prototype sample · not a live review</span><p>★ {{ placeDetails.place.rating }} · {{ placeDetails.place.reviews }} sample reviews</p><p>“{{ placeDetails.place.note }}”</p></div><p x-if="!placeDetails.place.mock">No reviews are linked to this stop.</p></section>
                        <section x-if="placeTab === 'Location'"><h3>{{ guide.location }}</h3><p>{{ placePlanNote() }}</p><button x-if="placeDetails.day >= 0" class="india-pill" type="button" @click="placeOnMap">Show on map</button></section>
                    </div>
                    <form class="india-chat-input place-panel-chat" @submit-prevent="askAboutPlace"><input x-model="prompt" placeholder="Ask TravelMore about this place…" aria-label="Ask about this place"><button type="submit" aria-label="Open place assistant">↑</button></form>
                </section>
            </aside>
        </section>
        <div x-if="placeGalleryOpen" class="sheet-backdrop india-overlay" @click.self="closePlaceGallery">
            <section class="place-photo-viewer" role="dialog" aria-modal="true" aria-label="Place photos">
                <button class="round-button place-viewer-close" type="button" @click="closePlaceGallery" aria-label="Close photos">×</button>
                <button class="guide-photo-arrow previous" type="button" @click="previousPlacePhoto" aria-label="Previous place photo">‹</button>
                <img :src="placeGallery()[placePhotoIndex].src" :alt="placeGallery()[placePhotoIndex].label">
                <button class="guide-photo-arrow next" type="button" @click="nextPlacePhoto" aria-label="Next place photo">›</button>
                <p>{{ placeGallery()[placePhotoIndex].label }}</p>
            </section>
        </div>
        <div x-if="manualOpen" class="sheet-backdrop india-overlay" @click.self="closeManual"><section class="dashboard-sheet india-form-dialog" role="dialog" aria-modal="true" aria-label="Plan manually">
            <header><h2>Plan manually</h2><button type="button" class="round-button" @click="closeManual" aria-label="Close">×</button></header>
            <form @submit-prevent="saveTrip">
                <p x-if="trip.place">Adding {{ trip.place }}</p><label>Destination<select x-model="trip.destination" required><option value="">Choose a city</option><option value="Jaipur">Jaipur</option><option value="Ahmedabad">Ahmedabad</option><option value="Hampi">Hampi</option></select></label>
                <div class="dashboard-date-grid"><label>Start date<input type="date" x-model="trip.start" required></label><label>End date<input type="date" x-model="trip.end" :min="trip.start" required></label></div>
                <label>Travelers<input type="number" x-model="trip.travelers" min="1" max="99" required></label><label>Daily budget per person<select x-model="trip.budget"><option value="">Choose your budget</option><option value="under-800">Under ₹800</option><option value="800-1500">₹800–1,500</option><option value="1500-2500">₹1,500–2,500</option></select></label><p class="student-form-tip">Start with dorm beds, shared autos or buses, and local thalis or street food.</p><div x-if="planningBudget()" class="student-form-picks"><strong>Sample picks for {{ trip.destination }}</strong><p x-for="stay in planningBudget().stays" :key="stay.title">{{ stay.title }} · {{ stay.price }} · ★ {{ stay.rating }} mock</p><p x-for="meal in planningBudget().meals[0]" :key="meal.id">{{ meal.title }} · {{ meal.price }} · ★ {{ meal.rating }} mock</p></div>
                <div class="sheet-actions"><button type="button" class="button-secondary" @click="closeManual">Cancel</button><button type="submit" class="button-primary">Save trip details</button></div>
            </form>
        </section></div>
        <div x-if="edit" class="sheet-backdrop india-overlay" @click.self="cancelEdit"><section class="dashboard-sheet india-form-dialog guide-stop-editor" role="dialog" aria-modal="true" aria-label="Edit itinerary stop">
            <header><h2>Edit stop</h2></header><form @submit-prevent="saveEdit">
                <label>Choose a different place
                    <select @change="chooseReplacement($event)" aria-describedby="replace-stop-help">
                        <option value="">Keep {{ edit.original.title }}</option>
                        <option x-for="place in stopAlternatives()" :key="place.title" :value="place.title">{{ place.title }} · {{ place.kind }}</option>
                    </select>
                </label>
                <p id="replace-stop-help" class="replace-stop-help">A replacement keeps this time slot and updates the route on the map.</p>
                <label>Place name<input x-model="edit.title" required></label>
                <div class="dashboard-date-grid"><label>Start time<input type="time" x-model="edit.time" required></label><label>Visit duration<input x-model="edit.duration" required></label></div>
                <label>Notes<textarea x-model="edit.note" rows="3"></textarea></label>
                <div class="sheet-actions"><button class="button-secondary" type="button" @click="cancelEdit">Cancel</button><button type="submit" class="button-primary">Save changes</button></div>
            </form>
        </section></div>
    </main>` },
    visibleGuides() {
        const query=this.data.query.value.trim().toLowerCase()
        return indiaGuides.filter(guide=>[guide.title,guide.location,guide.tag].some(text=>text.toLowerCase().includes(query)))
    },
    photos() { return photoGalleries[this.data.guide.value.id].map(([file,label])=>({src:'/discovery/'+file,label})) },
    cardPhoto(title) {
        const photo=this.photos().find(item=>item.label===title)
        if(photo) return {src:photo.src,alt:title,placeholder:false}
        const guide=this.data.guide.value
        return {src:guide.cover,alt:guide.location+' destination photo',placeholder:true}
    },
    travelNotes() { return destinationNotes[this.data.guide.value.id] },
    toggleIntro() { this.data.readMore.value=!this.data.readMore.value },
    revealCover(event) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        event.target.animate([{ opacity: .74 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' })
    },
    currentPhoto() { return this.photos()[this.data.photoIndex.value] },
    selectPhoto(index) { this.data.photoIndex.value=(index+this.photos().length)%this.photos().length },
    previousPhoto() { this.selectPhoto(this.data.photoIndex.value-1) },
    nextPhoto() { this.selectPhoto(this.data.photoIndex.value+1) },
    startSwipe(event) { this.swipeStart=event.changedTouches[0]?.clientX },
    endSwipe(event) {
        const delta=event.changedTouches[0]?.clientX-this.swipeStart
        if (Math.abs(delta)>60) this.selectPhoto(this.data.photoIndex.value+(delta<0?1:-1))
    },
    toggleSaved() {
        this.data.saved.value=!this.data.saved.value
        localStorage.setItem('india-saved-'+this.data.guide.value.id,JSON.stringify(this.data.saved.value))
    },
    shareUrl() { return location.origin+this.data.guide.value.link },
    toggleStickyShare() { this.data.shareStatus.value=''; this.data.stickyShareOpen.value=!this.data.stickyShareOpen.value },
    async shareGuide() {
        try { await navigator.clipboard.writeText(this.shareUrl()); this.data.stickyShareOpen.value=false; this.data.shareStatus.value='Link copied' }
        catch { this.data.shareStatus.value=this.shareUrl() }
    },
    toggleStopMenu() { this.toggleCategory('stops') },
    toggleFoodMenu() { this.toggleCategory('food') },
    toggleStaysMenu() { this.toggleCategory('stays') },
    toggleCategory(kind) { this.data.kindMenu.value=this.data.kindMenu.value===kind?'':kind },
    closeCategory() { this.data.kindMenu.value='' },
    categoryTitle() { return {stops:'Attractions and stops',food:'Budget food spots',stays:'Budget stays'}[this.data.kindMenu.value] },
    categoryRows() {
        const kind=this.data.kindMenu.value
        if(kind==='stays') return this.budget().stays.map(place=>({place,day:-1}))
        return this.data.guide.value.days.flatMap((day,index)=>(kind==='food'?this.foodForDay(index):day.stops).map(place=>({place,day:index})))
    },
    pickCategory(row) {
        this.closeCategory()
        if(row.day===-1) { this.openStay(row.place); return }
        this.openPlace(row.place,row.day)
    },
    openPlace(place,day) {
        this.data.placeTab.value='Overview'
        this.data.placeShare.value=''
        this.data.placeDetails.value={place:{...place},day}
        this.openMap()
        this.resetPlaceScroll()
    },
    placeGallery() {
        const place=this.data.placeDetails.value.place
        if(place.mock) {
            const photo=this.cardPhoto(place.title)
            return [{src:photo.src,label:photo.alt+' · placeholder'}]
        }
        const photos=this.photos()
        return photos.sort((a,b)=>Number(b.label===place.title)-Number(a.label===place.title))
    },
    openPlaceGallery(index) { this.data.placePhotoIndex.value=index; this.data.placeGalleryOpen.value=true },
    closePlaceGallery() { this.data.placeGalleryOpen.value=false },
    previousPlacePhoto() { this.changePlacePhoto(-1) },
    nextPlacePhoto() { this.changePlacePhoto(1) },
    changePlacePhoto(step) {
        const count=this.placeGallery().length
        this.data.placePhotoIndex.value=(this.data.placePhotoIndex.value+count+step)%count
    },
    async sharePlace() {
        const url=new URL(this.shareUrl())
        url.searchParams.set('place',this.data.placeDetails.value.place.title)
        try { await navigator.clipboard.writeText(url.href); this.data.placeShare.value='Place link copied' }
        catch { this.data.placeShare.value=url.href }
    },
    openStay(stay) { this.openPlace({...stay,kind:stay.kind,mock:true,note:stay.note},-1) },
    detailTabs() { return ['Overview','Guides','Activities','Reviews','Location'] },
    resetPlaceScroll() { requestAnimationFrame(()=>{ const panel=document.querySelector('.place-panel-body'); if(panel) panel.scrollTop=0 }) },
    setPlaceTab(tab) { this.data.placeTab.value=tab; this.resetPlaceScroll() },
    returnToMap() { this.closePlace() },
    placeSaved() { return this.cardSaved(this.data.placeDetails.value.place) },
    cardKey(place) { return this.data.guide.value.id+':'+place.title },
    cardSaved(place) { return this.data.savedPlaces.value.includes(this.cardKey(place)) },
    togglePlaceSaved() { this.toggleCardSaved(this.data.placeDetails.value.place) },
    toggleCardSaved(place) {
        const key=this.cardKey(place)
        const saved=this.data.savedPlaces.value
        const next=saved.includes(key)?saved.filter(item=>item!==key):[...saved,key]
        this.data.savedPlaces.value=next
        localStorage.setItem('india-saved-places',JSON.stringify(next))
    },
    addPlaceToTrip() { this.addCardToTrip(this.data.placeDetails.value.place) },
    addCardToTrip(place) {
        this.openManual()
        this.data.trip.value={...this.data.trip.value,place:place.title}
    },
    placePlanNote() {
        const day=this.data.placeDetails.value.day
        return day<0 ? this.data.guide.value.stay : 'Day '+(day+1)+' · '+this.data.guide.value.days[day].travel
    },
    relatedStops() {
        const {place,day}=this.data.placeDetails.value
        return day<0 ? [] : this.data.guide.value.days[day].stops.filter(stop=>stop.title!==place.title)
    },
    openRelated(stop) { this.openPlace(stop,this.data.placeDetails.value.day) },
    jumpToPlaceDay() {
        const day=this.data.placeDetails.value.day
        this.closePlace()
        if(this.data.mobileMap.value) this.closeMap()
        if(day<0) this.jumpBudget()
        else this.jumpDay(day)
    },
    askAboutPlace() {
        const {place}=this.data.placeDetails.value
        const question=this.data.prompt.value.trim() || 'Help me fit '+place.title+' into my trip.'
        this.goToInlinePlanner(question)
    },
    closePlace() { this.data.placeDetails.value=null },
    placeOnMap() {
        const {place,day}=this.data.placeDetails.value
        this.closePlace()
        this.focusStop(place,day)
    },
    fitMap() { this.data.selected.value=null; this.data.mapReset.value++ },
    toggleMapLayers() { this.data.mapLayers.value=!this.data.mapLayers.value },
    useDarkMap() { this.data.mapLight.value=false; this.data.mapLayers.value=false },
    useLightMap() { this.data.mapLight.value=true; this.data.mapLayers.value=false },
    openGuidePlanner() { this.goToInlinePlanner('Help me plan '+this.data.guide.value.title+'.') },
    goToInlinePlanner(question) {
        const guide=this.data.guide.value
        sessionStorage.setItem('india-inline-question',question)
        location.assign('/inspiration?plan='+encodeURIComponent(guide.id))
    },
    startGuideChat(id) {
        const guide=indiaGuides.find(item=>item.id===id)
        const question=sessionStorage.getItem('india-inline-question')
        sessionStorage.removeItem('india-inline-question')
        this.resetHomeChat()
        if (!guide) return
        const city=guide.location.split(',')[0]
        this.pickHomeCity(city)
        if(question) this.data.homeMessages.value=[{role:'user',text:question},...this.data.homeMessages.value]
    },
    editPlanDetails() { this.closeChat(); this.openManual() },
    mealCount() { return this.budget().meals.flat().length },
    jumpBudget() { this.jump('guide-budget') },
    showAttractions() { this.data.tab.value='places'; this.data.category.value='stops' },
    showFoodPlaces() { this.data.tab.value='places'; this.data.category.value='food' },
    placesForDay(day,index) {
        const category=this.data.category.value
        if (category==='stops') return day.stops
        if (category==='food') return this.foodForDay(index)
        return [...day.stops,...this.foodForDay(index)]
    },
    tripForGuide() {
        const guide=this.data.guide.value,trip=this.data.trip.value
        return trip.destination===guide.location.split(',')[0] ? trip : {}
    },
    budget() {
        const id=this.data.guide.value.id
        return {...budgetOptions[id],stays:lodgingFor(id,this.tripForGuide())}
    },
    personalizedDayNote(day,index) {
        const trip=this.tripForGuide()
        const notes=[]
        if(trip.pace==='Relaxed, less walking') notes.push('Keep '+day.stops[0].title+' as your anchor. Make the last stop optional if the group needs a break.')
        if(trip.pace==='Packed days') notes.push('Start with '+day.stops[0].title+' and keep a short buffer between stops.')
        if(trip.transport==='Walk and use public transport') notes.push('Start with walking or public transport where practical. Allow time for longer connections.')
        if(trip.transport==='Split autos or taxis') notes.push('Split the fares for longer legs and agree on a meeting point.')
        if(trip.diet && trip.diet!=='No preference') notes.push('Look for '+trip.diet.toLowerCase()+' food and confirm ingredients before ordering.')
        if(trip.substitution?.day===index && day.stops.some(stop=>stop.title===trip.substitution.title)) notes.push('Personalized stop: '+trip.substitution.title+' replaces '+trip.substitution.original+'.')
        return notes.join(' ')
    },
    planningBudget() { const destination=this.data.trip.value.destination.trim().toLowerCase(); return budgetOptions[destination] || null },
    foodForDay(day) { return this.budget().meals[day] },
    allGuides() { return indiaGuides },
    dayColor(index) { return itineraryDayColors[index % itineraryDayColors.length] },
    toggleSidebar() { this.data.sidebarCollapsed.value=!this.data.sidebarCollapsed.value },
    homeCities() { return indiaGuides.map(guide=>guide.location.split(',')[0]) },
    homePeopleOptions() { return [1,2,3,4,5,6] },
    homeChatPlaceholder() {
        return {city:'Choose or type a city…',budget:'Choose or type a budget…',people:'Enter the number of travelers…',dates:'Choose dates above or decide later',done:'Ask about costs, food, or getting around…'}[this.data.homeStep.value] || (this.profileQuestion() ? 'Choose or type an answer…' : 'Ask the travel assistant…')
    },
    submitHomeChat() {
        const input=this.data.homeInput.value.trim()
        this.data.homeInput.value=''
        const step=this.data.homeStep.value
        this.data.homeError.value=''
        if (!input) return
        if (step==='city') {
            const city=this.homeCities().find(city=>city.toLowerCase()===input.toLowerCase())
            if(city) this.pickHomeCity(city)
            else this.showHomeChatError('Choose Jaipur, Ahmedabad, or Hampi.')
        } else if (step==='budget') {
            const normalized=input.toLowerCase().replace(/[₹,\s]/g,'').replace(/[–—]/g,'-')
            const amount=Number(normalized)
            const option=planningBudgets.find(option=>option.value===normalized ||
                option.label.toLowerCase().replace(/[₹,\s]/g,'').replace(/[–—]/g,'-')===normalized)
            const value=option?.value || (Number.isInteger(amount) && amount>0 && amount<=2500 ? (amount<800?'under-800':amount<1500?'800-1500':'1500-2500') : '')
            if(value) this.pickHomeBudget(value)
            else this.showHomeChatError('Choose one of the three daily budget ranges.')
        } else if (step==='done') {
            if (!this.data.groqConfigured.value) {
                if (!this.data.groqCanConnect.value) {
                    this.showHomeChatError('The assistant is unavailable. You can still open your itinerary.')
                    return
                }
                this.data.groqPending.value=input
                this.showGroqSetup()
                return
            }
            this.data.homeMessages.value=[...this.data.homeMessages.value,{role:'user',text:input}]
            void this.requestGroq(input)
        } else if (this.profileQuestion()) {
            this.pickProfileAnswer(input.slice(0,80))
        } else if (step==='people') {
            if(/^\d{1,2}$/.test(input) && Number(input)>=1) this.pickHomePeople(Number(input))
            else this.showHomeChatError('Enter a number from 1 to 99.')
        }
    },
    resetHomeChat() {
        this.clearGroqChat()
        this.data.homeDraft.value=emptyTrip()
        this.data.homeStep.value='city'
        this.data.homeError.value=''
        this.data.homeMessages.value=[{role:'assistant',text:'Where would you like to go? Choose one of these three destinations.'}]
        this.scrollHomeChat()
    },
    closeHomeChat() { this.clearGroqChat(); this.data.homeStep.value=''; this.data.homeError.value=''; this.data.homeInput.value='' },
    pickHomeCity(city) {
        if(this.data.homeStep.value!=='city' || !this.homeCities().includes(city)) return
        this.data.homeDraft.value.destination=city
        this.advanceHomeChat(city,'What’s your daily budget per person?','budget')
    },
    pickHomeBudget(value) {
        if(this.data.homeStep.value!=='budget' || !this.budgetLabel(value)) return
        this.data.homeDraft.value.budget=value
        this.advanceHomeChat(this.budgetLabel(value)+' per person per day','How many people are traveling?','people')
    },
    pickHomePeople(count) {
        if(this.data.homeStep.value!=='people' || !Number.isInteger(count) || count<1 || count>99) return
        this.data.homeDraft.value.travelers=count
        this.advanceHomeChat(count+' '+(count===1?'traveler':'travelers'),profileQuestions.interests.text,'interests')
    },
    suggestedSwap() {
        const guide=this.homeGuide()
        if(!guide) return null
        const current=readLocal('india-guide-'+guide.id,guide)
        const interests=this.data.homeDraft.value.interests
        const options=replacementPlaces[guide.id]
        const preferred=interests==='Outdoors and views'?2:interests==='Food and markets'?1:0
        const used=new Set(current.days.flatMap(day=>day.stops.map(stop=>stop.title)))
        const alternative=[options[preferred],...options].find(place=>!used.has(place.title))
        const day=2
        const index=current.days[day].stops.findLastIndex((stop,i)=>stop.title===guide.days[day].stops[i]?.title)
        if(!alternative || index<0) return null
        return {day,index,original:current.days[day].stops[index].title,title:alternative.title}
    },
    profileQuestion() {
        const step=this.data.homeStep.value
        if(step!=='swap') return profileQuestions[step] || null
        const swap=this.suggestedSwap()
        return {...profileQuestions.swap,options:swap ? ['Try '+swap.title,'Keep the current itinerary'] : ['Keep the current itinerary']}
    },
    pickProfileAnswer(answer) {
        const step=this.data.homeStep.value
        const question=this.profileQuestion()
        if (!question || !answer.trim()) return
        if(step==='swap') {
            const swap=this.suggestedSwap()
            this.data.homeDraft.value.substitution=swap && answer==='Try '+swap.title ? swap : null
        } else this.data.homeDraft.value[step]=answer==='Skip for now' ? '' : answer
        this.advanceHomeChat(answer,this.nextProfileQuestion(question.next),question.next)
    },
    nextProfileQuestion(next) {
        if(next==='swap') {
            const swap=this.suggestedSwap()
            if(swap) return 'Swap '+swap.original+' for '+swap.title+' on Day '+(swap.day+1)+'? The time slot stays the same.'
        }
        return profileQuestions[next]?.text || 'When would you like to travel? You can also decide later.'
    },
    applyHomeSubstitution(guide,swap) {
        if(!swap) return
        const current=readLocal('india-guide-'+guide.id,guide)
        const stop=current.days[swap.day].stops[swap.index]
        const replacement=replacementPlaces[guide.id].find(place=>place.title===swap.title)
        if(!replacement || stop.title!==swap.original) return
        const edited=JSON.parse(JSON.stringify(current))
        edited.days[swap.day].stops[swap.index]={...stop,...replacement}
        localStorage.setItem('india-guide-'+guide.id,JSON.stringify(edited))
    },
    finishHomeDates() {
        const {start,end}=this.data.homeDraft.value
        if (!start || !end || end<start) { this.showHomeChatError('Choose a start and end date in order.'); return }
        this.saveHomePlan(start+' to '+end)
    },
    skipHomeDates() {
        Object.assign(this.data.homeDraft.value,{start:'',end:''})
        this.saveHomePlan('Decide later')
    },
    homeGuide() { return indiaGuides.find(guide=>guide.location.split(',')[0]===this.data.homeDraft.value?.destination) },
    homeGuideLink() { return this.homeGuide()?.link || '/inspiration' },
    saveHomePlan(answer) {
        if(this.data.homeStep.value!=='dates') return
        const guide=this.homeGuide()
        if(!guide) return
        const trip={...this.data.homeDraft.value,guideId:guide.id}
        this.applyHomeSubstitution(guide,trip.substitution)
        this.data.trip.value=trip
        localStorage.setItem('india-trip',JSON.stringify(trip))
        this.advanceHomeChat(answer,'Your preferences are saved for '+trip.destination+'. The guide has matching stay options'+(trip.substitution?' and your new stop':'')+'.','done')
        if (this.data.groqConfigured.value) void this.requestGroq('')
    },
    async loadGroqStatus() {
        try {
            const response=await fetch('/api/planner/status',{cache:'no-store'})
            if(response.ok) {
                const status=await response.json()
                this.data.groqConfigured.value=status.configured===true
                this.data.groqCanConnect.value=status.canConnect!==false
            }
        } catch { /* Planning questions work offline. */ }
    },
    showGroqSetup() { this.data.groqError.value=''; this.data.groqSetup.value=true; this.scrollHomeChat() },
    closeGroqSetup() { this.data.groqKey.value=''; this.data.groqSetup.value=false },
    clearGroqChat() {
        this.groqRequest=(this.groqRequest || 0)+1
        this.data.groqBusy.value=false
        this.data.groqError.value=''
        this.data.groqPending.value=''
        this.closeGroqSetup()
    },
    async connectGroq() {
        if(this.data.groqConnecting.value) return
        const key=this.data.groqKey.value.trim()
        this.data.groqConnecting.value=true
        this.data.groqError.value=''
        try {
            const response=await fetch('/api/planner/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})})
            const result=await response.json()
            if(!response.ok) throw new Error(result.error || 'Groq could not be connected.')
            this.data.groqConfigured.value=true
            this.closeGroqSetup()
            if(this.data.homeStep.value==='done') {
                const question=this.data.groqPending.value
                if(question) this.data.homeMessages.value=[...this.data.homeMessages.value,{role:'user',text:question}]
                void this.requestGroq(question)
            }
        } catch(error) { this.data.groqError.value=error.message || 'Groq could not be connected.' }
        finally { this.data.groqConnecting.value=false; this.scrollHomeChat() }
    },
    retryGroq() { void this.requestGroq(this.data.groqPending.value) },
    async requestGroq(question) {
        if(this.data.groqBusy.value) return
        const guide=this.homeGuide()
        if(!guide) return
        const request=this.groqRequest=(this.groqRequest || 0)+1
        this.data.groqBusy.value=true
        this.data.groqPending.value=question
        this.data.groqError.value=''
        this.scrollHomeChat()
        try {
            const saved=readLocal('india-guide-'+guide.id,null)
            const trip=this.data.trip.value
            const response=await fetch('/api/planner/reply',{
                method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({trip:{...trip,budget:this.budgetLabel(trip.budget)},days:(saved || guide).days.map(day=>day.stops.map(stop=>stop.title)),question}),
            })
            const result=await response.json()
            if(request!==this.groqRequest) return
            if(!response.ok) throw new Error(result.error || 'Groq couldn’t answer.')
            this.data.homeMessages.value=[...this.data.homeMessages.value,{role:'assistant',text:result.reply}]
            if(!question) localStorage.setItem('india-groq-plan-'+guide.id,JSON.stringify(result.reply))
        } catch(error) {
            if(request===this.groqRequest) this.data.groqError.value=error.message || 'Groq couldn’t answer.'
        } finally {
            if(request===this.groqRequest) { this.data.groqBusy.value=false; this.scrollHomeChat() }
        }
    },
    advanceHomeChat(answer,question,next) {
        this.data.homeError.value=''
        this.data.homeMessages.value=[...this.data.homeMessages.value,{role:'user',text:answer},{role:'assistant',text:question}]
        this.data.homeStep.value=next
        this.scrollHomeChat()
    },
    showHomeChatError(message) { this.data.homeError.value=message; this.scrollHomeChat() },
    scrollHomeChat() {
        requestAnimationFrame(()=>{
            const thread=this.refs.homeThread
            if(thread) thread.scrollTop=thread.scrollHeight
        })
    },
    openChat() {
        const request=this.data.prompt.value.trim().toLowerCase()
        this.data.prompt.value=''
        if (/replace|swap|different place/.test(request)) this.chooseGuideEdit('place')
        else if (/time|duration/.test(request)) this.chooseGuideEdit('time')
        else if (/note/.test(request)) this.chooseGuideEdit('notes')
        else this.showGuideEditActions()
    },
    showGuideEditActions() { this.data.guideChatStep.value='action' },
    closeGuideChat() { this.data.guideChatStep.value=''; this.data.guideEditStatus.value='' },
    showGuideEditDays() { this.data.guideChatStep.value='day' },
    chooseGuideEdit(mode) {
        this.data.guideEditMode.value=mode
        this.data.guideEditStatus.value=''
        this.showGuideEditDays()
    },
    chooseGuideEditDay(day) {
        this.data.guideEditDay.value=day
        this.data.guideChatStep.value='stop'
    },
    editFromGuideChat(index) {
        const day=this.data.guideEditDay.value
        const stop=this.data.guide.value.days[day].stops[index]
        if(!stop) return
        this.editStop(stop,day,index)
        this.data.edit.value.fromChat=true
        const field={place:'select',time:'input[type=time]',notes:'textarea'}[this.data.guideEditMode.value]
        if(field) requestAnimationFrame(()=>document.querySelector('.guide-stop-editor '+field)?.focus())
    },
    budgetChoices() { return planningBudgets },
    budgetLabel(value) { return planningBudgets.find(item=>item.value===value)?.label || '' },
    guidePreferences() {
        const guide=this.data.guide.value
        const trip=this.data.trip.value
        const budget=this.budgetLabel(trip.budget)
        if (!guide || !budget || (trip.destination && trip.destination!==guide.location.split(',')[0])) return ''
        return trip.travelers+' '+(Number(trip.travelers)===1?'traveler':'travelers')+' · '+budget+' per person per day'
    },
    openManual() {
        const draft={...emptyTrip(),...readLocal('india-trip',{})}
        const guide=this.data.guide.value
        if (guide) {
            draft.destination=guide.location.split(',')[0]
            draft.guideId=guide.id
        }
        this.data.trip.value=draft
        this.data.manualOpen.value=true
    },
    closeManual() { this.data.trip.value=readLocal('india-trip',emptyTrip()); this.data.manualOpen.value=false },
    saveTrip() {
        const trip=this.data.trip.value
        if (!indiaGuides.some(guide=>guide.location.split(',')[0]===trip.destination) || !trip.start || !trip.end || trip.end < trip.start) return
        localStorage.setItem('india-trip',JSON.stringify({...trip,destination:trip.destination.trim()}))
        this.closeManual()
    },
    editStop(stop,day,index) {
        this.data.edit.value={...stop,day,index,original:{...stop}}
    },
    stopAlternatives() {
        const guide=this.data.guide.value
        const original=this.data.edit.value.original
        const inUse=new Set(guide.days.flatMap(day=>day.stops.map(stop=>stop.title)))
        const base=indiaGuides.find(item=>item.id===guide.id)
        const candidates=[...replacementPlaces[guide.id],...base.days.flatMap(day=>day.stops)]
        return candidates.filter(place=>place.title!==original.title && !inUse.has(place.title))
    },
    chooseReplacement(event) {
        const edit=this.data.edit.value
        const title=event.target.value
        const place=title ? this.stopAlternatives().find(item=>item.title===title) : edit.original
        if (!place) return
        const {lat,lng,kind,duration,note}=place
        Object.assign(edit,{title:place.title,lat,lng,kind,duration,note})
    },
    cancelEdit() { this.data.edit.value=null },
    saveEdit() {
        const {day,index,title,time,duration,note,kind,lat,lng,fromChat}=this.data.edit.value
        if (!title.trim() || !duration.trim()) return
        const guide=JSON.parse(JSON.stringify(this.data.guide.value))
        Object.assign(guide.days[day].stops[index],{title:title.trim(),time,duration:duration.trim(),note,kind,lat,lng})
        localStorage.setItem('india-guide-'+guide.id,JSON.stringify(guide))
        this.data.selected.value=null
        this.data.guide.value=guide
        if(this.data.activeDay.value>=0) this.data.activeDay.value=day
        this.cancelEdit()
        if(fromChat) {
            this.data.guideEditStatus.value='Updated '+title.trim()+' on Day '+(day+1)+'.'
            this.showGuideEditActions()
        }
    },
    showOverview() { this.data.tab.value='overview' },
    showPlaces() { this.data.tab.value='places'; this.data.category.value='all' },
    toggleContents() { this.data.contents.value=this.data.contents.value===1 ? 0 : 1 },
    toggleStickyContents() { this.data.contents.value=this.data.contents.value===2 ? 0 : 2 },
    jump(target) {
        this.showOverview()
        this.data.contents.value=0
        requestAnimationFrame(()=>{ const section=document.getElementById(target); if (section?.tagName === 'DETAILS') section.open=true; section?.scrollIntoView({block:'start'}) })
    },
    jumpDay(index) { this.filterDay(index); this.jump('day-'+index) },
    jumpStay() { this.jump('guide-stay') },
    jumpFood() { this.jump('guide-food') },
    jumpShopping() { this.jump('guide-shopping') },
    openMap() { this.data.mobileMap.value=true },
    closeMap() { this.data.mobileMap.value=false },
    filterDay(index) { this.data.selected.value=null; this.data.activeDay.value=index },
    showDay(index) { this.filterDay(index); this.openMap() },
    showAll() { this.filterDay(-1) },
    focusStop(stop,index) { this.data.activeDay.value=index; this.data.selected.value={...stop}; this.openMap() },
}
