const { SlashCommandBuilder } = require('@discordjs/builders');
const _ = require('lodash');


const hiragana = [
  'あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ',
  'た','ち','つ','て','と','な','に','ぬ','ひ','ふ','へ','ほ','ま','み','む',
  'め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','ゐ','を','ん'
];


module.exports = {
  data: new SlashCommandBuilder()
    .setName('글자')
    .setDescription('랜덤 영어 / 한국어 / 일본어 문자열 생성')
    .addIntegerOption(o =>
      o.setName('count')
       .setDescription('개수 (최대 2000)')
       .setRequired(false)
    ).addStringOption(o =>
      o.setName('언어')
       .setDescription('한국어 출력 / 영어 출력')
       .addChoices(
         { name: '영어', value: 'en' },
         { name: '한국어', value: 'ko' }
       )
       .setRequired(true)
    )
    ,
    

  async execute(interaction) {
    const cnt = interaction.options.getInteger('count') || 1;
    if (cnt > 2000) return interaction.reply('최대 2000개까지 지원합니다.');

    let out = '';
    for (let i = 0; i < cnt; i++) {
      out += String.fromCharCode(97 + _.random(0, 25));
    }
    await interaction.reply(out);
  },
};


//미완. 마이그레이션 완료 시 해당 주석을 삭제하세요