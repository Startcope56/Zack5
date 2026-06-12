const PROFANITY_LIST = [
  // Filipino
  "putang ina","putangina","tang ina","tangina","puta","gago","gaga","bobo","boba",
  "tanga","ulol","hayop","hayup","lintik","leche","pakshet","pakyu","pakshit",
  "piste","buwisit","kupal","tarantado","yemete","kulasai","iyot","kantot",
  "punyeta","siraulo","inutil","bugo","bogo","gagi","demonyo","diyablo",
  "salot","amputa","ampota","putcha","pucha","punyeta","shet","shetty",
  // English
  "fuck","f*ck","fck","shit","s*it","bitch","bastard","asshole","ass hole",
  "motherfucker","mother fucker","cunt","pussy","dick","cock","whore","slut",
  "nigger","nigga","faggot","retard","stupid","idiot",
];

export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().replace(/[\s_\-\.]+/g, " ");
  for (const word of PROFANITY_LIST) {
    if (lower.includes(word)) return true;
  }
  return false;
}

export function censorProfanity(text: string): string {
  let result = text;
  for (const word of PROFANITY_LIST) {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    result = result.replace(regex, "*".repeat(word.length));
  }
  return result;
}
