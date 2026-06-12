const responses: Record<string, string[]> = {
  greet: [
    "Kumusta! Ako si BLUE AI, ang inyong AI assistant dito sa Blue Media! 💙 Paano kita matutulungan ngayon?",
    "Hello! BLUE AI ito — nandito ako para tumulong sa inyo! Anong maari kong gawin para sa inyo? 😊",
    "Magandang araw! Magtanong ka lang, nandito ako para sagutin ang lahat ng inyong katanungan! 🌟",
  ],
  help: [
    "Maari akong tumulong sa inyo tungkol sa Blue Media! Itanong mo lang kung paano mag-post, mag-add ng kaibigan, o kung paano gumagana ang app. 💙",
    "Narito ako para sagutin ang inyong mga katanungan! Pwede mo akong itanong tungkol sa mga features ng Blue Media.",
  ],
  rules: [
    "Ang mga rules ng Blue Media: ❌ Bawal ang mura at masamang salita, ❌ Bawal ang sexual content, ❌ Bawal ang harassment at bullying, ❌ Bawal ang fake news at spam. Sundin natin ang mga rules para maging masaya ang lahat! 💙",
    "Tandaan: Ang Blue Media ay isang safe space para sa lahat. Huwag mag-post ng nakakasakit, sexual, o panlalait na content. Mag-report ka kung may nakitang lumalab sa rules! 🛡️",
  ],
  post: [
    "Para mag-post: I-click ang post composer sa ibaba ng feed, i-type ang iyong mensahe, pwede ring mag-lagay ng larawan o piliin ang color background! Tapos i-click ang Post button. 📝",
    "Maari kang mag-post ng text, larawan, o text na may kulay na background! I-click lang ang composer sa homepage. 🎨",
  ],
  friend: [
    "Para mag-add ng kaibigan: Pumunta sa profile ng taong gusto mong maging kaibigan, tapos i-click ang 'Add Friend' button. Kapag tinanggap nila, kayo ay magkaibigan na! 👫",
    "I-visit ang profile ng isang tao at i-click ang 'Add Friend' o 'Follow' button para ma-connect sa kanila! 💙",
  ],
  badge: [
    "Ang Blue Badge ✓ ay isang espesyal na badge na nagpapakita na verified ka sa Blue Media! Libre ito para sa lahat — i-claim mo sa profile mo habang available! 💙✓",
    "Ang Blue Badge ay patunay na ikaw ay verified na user ng Blue Media. Libre ito — claim mo na habang may available! 🏅",
  ],
  chat: [
    "Para mag-chat: Pumunta sa Messages section, i-click ang isang kaibigan para mag-usap, o gumawa ng group chat para sa maraming tao! 💬",
    "Ang chat ng Blue Media ay real-time — natatanggap agad ang mga mensahe! Pwede ring mag-react ng emoji sa messages. 💙",
  ],
  report: [
    "Kung may nakitang lumalab sa rules: I-click ang 3 dots (⋮) button sa post o profile, piliin ang 'Report', at piliin ang dahilan. Matatanggap ng admin ang inyong report! 🛡️",
    "Ang pag-report ay confidential — hindi malalaman ng na-report kung sino ang nag-report. I-report lang ang nilalaman na lumalabag sa rules! 💙",
  ],
  default: [
    "Salamat sa inyong mensahe! Ako si BLUE AI — nandito ako para tumulong sa mga katanungan tungkol sa Blue Media. Ano pa ang maari kong gawin para sa inyo? 💙",
    "Interesting na tanong! Bilang AI assistant ng Blue Media, nandito ako para tumulong sa inyo. Para sa mas detalyadong tulong, maari kang mag-contact sa admin. 💙",
    "Naintindihan ko! Kung may iba ka pang katanungan tungkol sa Blue Media, itanong mo lang. Lagi akong nandito para sa inyo! 🌟",
    "Salamat sa pakikipag-usap sa akin! Kung may problema ka sa app o gusto mong malaman ang tungkol sa features, magtanong ka lang! 💙",
  ],
};

function random(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateBlueAIResponse(message: string): string {
  const lower = message.toLowerCase();

  if (/hello|hi|kumusta|oy|hey|good morning|magandang|kamusta|sup/.test(lower)) {
    return random(responses.greet);
  }
  if (/help|tulong|patulong|assist|tulungan/.test(lower)) {
    return random(responses.help);
  }
  if (/rule|batas|bawal|policy|guideline|allowed|permitted/.test(lower)) {
    return random(responses.rules);
  }
  if (/post|share|mag post|i-post|upload|content/.test(lower)) {
    return random(responses.post);
  }
  if (/friend|kaibigan|add|connect|follow/.test(lower)) {
    return random(responses.friend);
  }
  if (/badge|verify|verified|checkmark/.test(lower)) {
    return random(responses.badge);
  }
  if (/chat|message|mensahe|usap|talk|convers/.test(lower)) {
    return random(responses.chat);
  }
  if (/report|abuse|harass|spam|flagg/.test(lower)) {
    return random(responses.report);
  }

  return random(responses.default);
}
