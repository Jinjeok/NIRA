import { SlashCommandBuilder } from '@discordjs/builders';
import _ from 'lodash';


const nihongo = [
  'あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ',
  'た','ち','つ','て','と','な','に','ぬ','ひ','ふ','へ','ほ','ま','み','む',
  'め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','ゐ','を','ん',
  'ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ',
  'タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ヒ','フ','ヘ','ホ','マ','ミ','ム',
  'メ','モ','ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ','ヰ','ヲ','ン'
]

export default {
  data: new SlashCommandBuilder()
    .setName('문자열')
    .setDescription('랜덤 영어 / 한국어 / 일본어 문자열을 생성합니다.')
    .addStringOption(o =>
      o.setName('언어')
       .setDescription('언어 출력 선택')
       .addChoices(
         { name: '영어', value: 'en' },
         { name: '한국어', value: 'ko' },
         { name: '일본어', value: 'jp' }
       )
       .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('길이')
       .setDescription('출력할 문자열의 개수 (최대 2000)')
       .setRequired(false)
    )
    ,
    

  async execute(interaction) {
    const lng = interaction.options.getString('언어') || 1;
    const cnt = interaction.options.getInteger('길이') || 1;
    if (cnt > 2000) return interaction.reply('최대 2000개까지 지원합니다.');

    let out = '';

    if(lng == 'en') {
      for (let i = 0; i < cnt; i++) {
        out += String.fromCharCode(97 + _.random(0, 25));
      }
    } else if(lng == 'ko') {
      for (let i = 0; i < cnt; i++) {
        out += String.fromCharCode(44031 + _.random(0, 11171));
      }
    } else if (lng == 'jp') {
      for (let i = 0; i < cnt; i++) {
        out += nihongo[_.random(0, nihongo.length - 1)];
      }
    }
    await interaction.reply(out);
  },
};
