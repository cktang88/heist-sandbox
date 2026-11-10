import { bark } from '../security/barks'
import { log } from '../security/report'
import type { World } from '../world'
import { overheard } from './knowledge'
import { callName } from './people'
import type { PeopleState, Person } from './types'

/**
 * What people say, from templates with several phrasings. `{other}` is the colleague the line is about,
 * `{deed}` how the intruder works, `{count}` how many are down, `{site}` an earlier heist's site.
 * Nobody repeats a line said lately, and each person keeps a little time between his own lines.
 */
export const TALK = {
  // Bonds
  griefBerserk: ['{other}! You\'re dead, you hear me?', 'That was {other}. That was {other}!', 'For {other}. I\'m coming for you.'],
  griefBreak: ['No... not {other}. Not {other}...', '{other}? Get up. Please get up.', 'I can\'t... {other}\'s gone. I can\'t do this.'],
  rivalDown: ['Typical {other}. Walked right into it.', '{other} always did rush in.', 'Should have listened, {other}.'],
  rivalNoHelp: ['Get someone else. I\'m not babysitting {other}.', '{other} can sort it out himself.', 'Not following {other} anywhere.'],
  rivalFalseAlarm: ['{other}\'s hearing ghosts again.', 'Another one of {other}\'s noises.', 'Control, {other} is jumping at shadows.'],
  mentorShield: ['Stay behind me, kid.', 'Easy, {other}. Do what I do.', 'Head down, {other}. I\'ve got you.'],
  rookieLost: ['{other} said this job was easy.', 'What do I do, {other}? What do I do?'],
  partnerStays: ['I\'m not leaving you, {other}.', 'Hang on, {other}. I\'m right here.', 'Nobody touches {other}.'],
  shieldFriend: ['Let {other} go!', 'That\'s {other}! Hold fire!', '{other}, hang on, we\'ll get you out!'],
  shieldRival: ['I\'ve got a shot past {other}... almost.', 'Sorry, {other}. Nothing personal.'],
  coverFriend: ['Control, {other}\'s with me. Radio\'s playing up.', 'Control, {other}\'s on the loo. Give him a minute.', '{other}\'s fine, Control. Battery died.'],
  debtDown: ['There goes my money, {other}.', '{other} still owed me forty.'],
  // Idle chat between two who know each other
  chatFriends: ['You see the match last night, {other}?', '{other}, you still owe me a coffee.', 'Two more hours, {other}. Two more.', 'How\'s the knee, {other}?'],
  chatRivals: ['Shouldn\'t you be on your route, {other}?', 'Nice of you to show up, {other}.'],
  chatCouple: ['Dinner after shift, {other}?', 'Don\'t tell anyone, {other}.'],
  chatDebt: ['About that money, {other}...', 'Friday, {other}. I swear.'],
  chatMentor: ['Watch the corners, {other}. Always the corners.', 'Good work tonight, {other}.'],
  // Memory
  woke: ['Ugh... what hit me?', 'Where... my head...', 'Who turned the lights... oh. Oh no.'],
  wokeTalk: ['Somebody choked me out. Came from nowhere.', 'He got me from behind. Never saw him.', 'I was out cold. He\'s in the building.'],
  spared: ['He let me live. I\'m not going back in there.', 'He had me. He just... walked away.', 'Hands up and he let me go. Lucky.'],
  sparedVeteran: ['He spared me. Big mistake.', 'He should have finished it.'],
  sawPlayer: ['I saw him. {deed}.', 'Got a good look at him. {deed}.', 'It\'s one man. {deed}.'],
  falseAlarmTwice: ['Twice now. Somebody\'s throwing things.', 'Not falling for that again.', 'Same trick twice? I know you\'re here.'],
  downCount: ['That\'s {count} of ours down. {other} isn\'t answering.', '{count} down. Where\'s {other}?', '{other} isn\'t answering. That\'s {count} now.'],
  friendGone: ['Has anyone heard from {other}?', '{other} isn\'t answering. That\'s not like him.', 'Come on, {other}, pick up.'],
  wounded: ['I\'m bleeding. I\'m actually bleeding.', 'He winged me. I\'m fine. I\'m fine.'],
  hostageAfter: ['He used me as a shield. A shield!', 'I had his arm round my throat...'],
  // Returning from an earlier heist
  vengeful: ['You. The {site} job. I had six weeks in hospital because of you.', 'Remember me? {site}. I remember you.', 'I\'ve waited for this since {site}.'],
  terrified: ['No. No no no. Not you again. I quit!', 'It\'s him from {site}! I\'m out, I\'m out!'],
  grateful: ['You let me walk at {site}. I didn\'t see you. We\'re square.', '{site}. I owe you one. Go. Quick.'],
  wary: ['I know how you work. {site}. Not this time.', 'Same moves as {site}. I\'m ready for you.'],
  // Traits showing themselves
  startle: ['Gah! Who\'s there?!', 'Jesus! What was that?', 'Who\'s that? WHO\'S THAT?'],
  callItIn: ['Control, checking a noise. Will advise.', 'Control, I\'ve got something. Going to look.', 'Control, possible disturbance, checking.'],
  greedy: ['Look, I\'ve got bills. I never saw you.', 'You didn\'t see me, I didn\'t see you. Deal?'],
  loyal: ['I\'m not telling you anything.', 'Do what you want. I don\'t talk.'],
  nightBlind: ['Can\'t see a thing in this light. Never could.', 'These eyes... is that someone?'],
  halfDeaf: ['What? Say again?', 'Did somebody say something?'],
  // Idle acts
  yawn: ['*yaaawn*', 'Mmh. Long night.', '*yawns* Who schedules these shifts?'],
  hungover: ['Never again. Never drinking again.', 'Why is everything so loud...', 'My head. My poor head.'],
  stretch: ['*stretches* Ohh, my back.', '*cracks neck*'],
  phone: ['*checks phone* Come on, reply...', '*scrolling*', 'Battery\'s at four percent. Great.'],
  hum: ['Hmm hm hmmm...', '*hums a jingle*', 'Da da daaa...'],
  smoke: ['*lights up* Just one.', '*smoking* Don\'t tell the sergeant.', '*exhales* That\'s better.'],
  coffee: ['This coffee is a crime.', 'Who made this? It\'s tar.', 'Coffee\'s cold again.'],
  scold: ['{other}! Shirt tucked, eyes front!', 'You call that a patrol, {other}?', 'Radio on your belt, {other}, not in your pocket.'],
  speech: ['"Friends, family..." no. "Dear guests..."', '"I\'ve known him since we were kids..."', '"To the happy couple..." Ugh.'],
  noticeboard: ['Mandatory overtime. Again.', 'Who signed me up for the fire drill?', '"Report all suspicious activity." Sure.'],
  lean: ['Nobody\'s coming. Nobody ever comes.', 'Five minutes. Nobody will notice.'],
  green: ['Is it always this quiet?', 'Which way is the east stairwell again?', 'First week. Don\'t mess it up.'],
  trip: ['Ow! Who left that there?', '*clatter* ...damn it.', 'Whoops. Nobody saw that.'],
} as const

export type TalkKind = keyof typeof TALK
/** `about` is the colleague a line names: his name fills `{other}`, and a player in earshot learns it. */
export type Fill = { about?: Person; other?: string; deed?: string; count?: number; site?: string }

const RECENT = 24
const OWN_GAP = 6

function fill(people: PeopleState, line: string, values: Fill): string {
  return line
    .replaceAll('{other}', values.about ? callName(people, values.about) : values.other ?? 'him')
    .replaceAll('{deed}', values.deed ?? 'Masked, armed')
    .replaceAll('{count}', String(values.count ?? 2))
    .replaceAll('{site}', values.site ?? 'last')
}

/** A phrasing of this kind not said lately, or null if every one was. */
export function freshTalk(people: PeopleState, kind: TalkKind, values: Fill = {}): string | null {
  const options = TALK[kind].map((line) => fill(people, line, values)).filter((line) => !people.recent.includes(line))
  if (options.length === 0) return null
  const line = options[Math.floor(people.rng() * options.length)]
  people.recent.push(line)
  if (people.recent.length > RECENT) people.recent.shift()
  return line
}

/**
 * Says a line over this person's head. `urgent` lines (grief, a returning enemy) push past the bark cooldown;
 * the rest wait until he has had a moment. Returns whether it was said.
 */
export function say(world: World, people: PeopleState, person: Person, kind: TalkKind, values: Fill = {}, urgent = false): boolean {
  if (!urgent && (world.clock < person.nextTalkAt || person.guard.barkCooldown > 0)) return false
  const line = freshTalk(people, kind, values)
  if (!line) return false
  bark(world, person.guard, line, urgent)
  person.nextTalkAt = world.clock + OWN_GAP
  if (values.about) overheard(world, person, values.about)
  return true
}

/** A line on the radio net (the log the HUD shows), under this person's name. */
export function radio(world: World, people: PeopleState, person: Person, kind: TalkKind, values: Fill = {}): boolean {
  const line = freshTalk(people, kind, values)
  if (!line) return false
  log(world, `${person.last}: ${line}`)
  return true
}
