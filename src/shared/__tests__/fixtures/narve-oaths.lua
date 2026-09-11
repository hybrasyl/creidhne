-- Narve (Piet), the Oaths dialog: text table and the OnSpawn section, verbatim
-- from world/scripts/npc/Piet/Narve.lua. The acceptance case for HTOO-458.

oaths = {
  --intro 1-5
  "Ah, an Aisling! Oh, how exciting! Welcome, welcome! You're about to embark on a fantastical journey as a priest! Now, let's talk about oaths, shall we? They're super important! They define your path and, oh, they're just so fascinating!",
  "So, we've got two oaths for you to choose from: the Oath of Dusk and the Oath of Dawn. Each one is brimming with possibilities!",
  "The Oath of Dusk! It's all about shadows and mystery! Think of it as harnessing the twilight's energy to smack down anyone threatening the balance. Dark, dangerous, and oh-so thrilling!",
  "And then there's the Oath of Dawn! Light, healing, protection! It's like a warm sunrise, full of hope and promise. Perfect for those who want to mend and nurture. So bright and shiny!",
  "Now, remember, your choice here will shape your journey and your connection to the divine. So, pick wisely! It's like choosing the perfect outfit for a grand adventure - your deity will be your guide and your fashion inspiration!",
  --menu text popup 6
  "So, what'll it be? Dark and mysterious or bright and hopeful? Oh, the suspense!",
  --choose dusk 7-11
  "Ooh, the Oath of Dusk! How deliciously dark! You're choosing to dance with shadows and wield the power of the night. It's thrilling, really! A path for those who aren't afraid of a little, or a lot, of danger!",
  "But hey, don't worry! If the shadows start feeling a bit too... shadowy, you can always switch to the light. The divine is flexible like that!",
  "Of course, switching from dusk to dawn isn't like flipping a switch. It takes time to adjust, to cleanse the shadowy vibes, and embrace the sunny side. It's a process, but oh, what a transformation it could be!",
  "Now, think it over! Being a priest isn't just about the fun of wielding power; it's about the reasons behind it! Whether you go for the shadowy thrills of Dusk or the sunny warmth of Dawn, remember, it's your own unique journey! And hey, don't expect too much gratitude - people are funny like that!",
  "Ready to take the plunge into the shadows? Let the excitement begin!",
  --yes dusk 12
  "Congratulations, shadow-walker! You've embraced the Oath of Dusk, stepping into a world full of mystery and power. You'll be a force against chaos, using the shadows to keep the balance. It's an exciting path, full of twists and turns! Let the adventure commence!",
  --no dusk 13
  "Not feeling the shadows? That's perfectly fine! The Oath of Dawn is still on the table, bright and full of potential! Healing, protecting - it's all so lovely and warm. Choose what feels right in your heart!",
  --choose dawn 14-17
  "Ah, the Oath of Dawn! You're a beacon of light, ready to heal and protect! So wonderful and bright! It's a path for those who want to spread warmth and care, like a big, comforting hug!",
  "But, if the time ever comes that you feel the need for a bit more edge, the shadows are always there. The Oath of Dusk can be quite the experience if you're looking for something different.",
  "Switching from dawn to dusk is a big shift - like going from a sunny day to a moonlit night. It's not easy, but it's possible with some deep reflection and a bit of courage.",
  "So, are you ready to bask in the glow of the Oath of Dawn? It's a bright choice, full of possibilities!",
  --yes dawn 18
  "Welcome to the light, healer! By choosing the Oath of Dawn, you're stepping into a role of compassion and protection. You'll be a guiding light, helping those in need. It's such a noble path, full of hope and joy! Shine bright!",
  --no dawn 19
  "Not feeling the sunshine? No worries! The Oath of Dusk is still an option. It's a path with a bit more... edge. Whatever you choose, make sure it aligns with who you are and what you feel called to do.",
  --already dusk 20
  "Ah, you've already embraced the shadows with the Oath of Dusk! You're all set to weave through the night and keep the balance. It's a thrilling path, isn't it? Full of intrigue and mystery! Keep those shadowy skills sharp!",
  --already dawn 21
  "You've already chosen the Oath of Dawn! You're all about healing and protection, spreading light wherever you go. It's a beautiful path, full of warmth and care. Keep shining bright and guiding others!",
  --too soon to change 22
  "Once you've picked an oath, you're committed for a full octant. That's just the way it is! Use this time to really delve into your chosen path. Reflect, grow, and who knows? You might discover something amazing!",
  --decision menu 23
  "So, what's it gonna be? Dark and mysterious, or bright and hopeful? The suspense is killing me!",
  --think it over 24
  "Still deciding? That's okay! It's a big choice, after all. Take your time, think it through. When you're ready, come back and let me know. Can't wait to see what you choose!",
  --already taken 25
  "Oh, you've already sworn an oath! No need to go over it again. Just keep on your path and see where it leads you!"
}

function OnSpawn()
  -- Oaths --
  priest_oaths_lecture = world.NewDialogSequence("Oaths", world.NewFunctionDialog("priest_oaths_check()"))

  priest_oaths_intro_dialog = world.NewDialogSequence("priest_oaths_intro",
    world.NewDialog(oaths[1]),
    world.NewDialog(oaths[2]),
    world.NewDialog(oaths[3]),
    world.NewDialog(oaths[4]),
    world.NewDialog(oaths[5]),
    world.NewJumpDialog("priest_oaths_menu"))

  priest_oaths_menu_options = world.NewDialogOptions()
  priest_oaths_menu_options.AddOption("Let me think on this", world.NewJumpDialog("priest_oaths_think_it_over"))
  priest_oaths_menu_options.AddOption("Tell me of the Oath of Dusk", world.NewJumpDialog("priest_oaths_dusk_info"))
  priest_oaths_menu_options.AddOption("Tell me of the Oath of Dawn", world.NewJumpDialog("priest_oaths_dawn_info"))
  priest_oaths_menu_options.AddOption("I know what I would choose", world.NewJumpDialog("priest_oaths_quick"))

  priest_oaths_menu_dialog = world.NewDialogSequence("priest_oaths_menu",
    world.NewOptionsDialog(oaths[6], priest_oaths_menu_options))

  priest_oaths_quick_options = world.NewDialogOptions()
  priest_oaths_quick_options.AddOption("I am actually not ready to decide",
    world.NewJumpDialog("priest_oaths_think_it_over"))
  priest_oaths_quick_options.AddOption("I choose the Oath of Dusk", "priest_oaths_duskmaker()")
  priest_oaths_quick_options.AddOption("I choose the Oath of Dawn", "priest_oaths_dawnmaker()")

  priest_oaths_quick_dialog = world.NewDialogSequence("priest_oaths_quick",
    world.NewOptionsDialog(oaths[23], priest_oaths_quick_options))

  priest_oaths_too_soon_dialog = world.NewDialogSequence("priest_oaths_too_soon",
    world.NewDialog(oaths[22]),
    world.NewFunctionDialog("source.EndDialog()"))

  priest_oaths_think_it_over_dialog = world.NewDialogSequence("priest_oaths_think_it_over",
    world.NewDialog(oaths[24]),
    world.NewFunctionDialog("source.EndDialog()"))

  priest_oaths_already_taken_dialog = world.NewDialogSequence("priest_oaths_already_taken",
    world.NewDialog(oaths[25]),
    world.NewFunctionDialog("source.EndDialog()"))

  -- Dusk --
  priest_oaths_dusk_info_options = world.NewDialogOptions()
  priest_oaths_dusk_info_options.AddOption("Let me hear of other things.", world.NewJumpDialog("priest_oaths_menu"))
  priest_oaths_dusk_info_options.AddOption("I take the Oath of Dusk", "priest_oaths_duskmaker()")

  priest_oaths_dusk_info_dialog = world.NewDialogSequence("priest_oaths_dusk_info",
    world.NewDialog(oaths[7]),
    world.NewDialog(oaths[8]),
    world.NewDialog(oaths[9]),
    world.NewDialog(oaths[10]),
    world.NewOptionsDialog(oaths[11], priest_oaths_dusk_info_options))

  priest_oaths_congrats_dusk_dialog = world.NewDialogSequence("priest_oaths_congrats_dusk",
    world.NewDialog(oaths[12]),
    world.NewFunctionDialog("source.EndDialog()"))

  -- Dawn --
  priest_oaths_dawn_info_options = world.NewDialogOptions()
  priest_oaths_dawn_info_options.AddOption("Let me hear of other things", world.NewJumpDialog("priest_oaths_menu"))
  priest_oaths_dawn_info_options.AddOption("I take the Oath of Dawn", "priest_oaths_dawnmaker()")

  priest_oaths_dawn_info_dialog = world.NewDialogSequence("priest_oaths_dawn_info",
    world.NewDialog(oaths[14]),
    world.NewDialog(oaths[15]),
    world.NewDialog(oaths[16]),
    world.NewOptionsDialog(oaths[17], priest_oaths_dawn_info_options))

  priest_oaths_congrats_dawn_dialog = world.NewDialogSequence("priest_oaths_congrats_dawn",
    world.NewDialog(oaths[18]),
    world.NewFunctionDialog("source.EndDialog()"))

  origin.RegisterSequence(priest_oaths_intro_dialog)
  origin.RegisterSequence(priest_oaths_menu_dialog)
  origin.RegisterSequence(priest_oaths_quick_dialog)
  origin.RegisterSequence(priest_oaths_too_soon_dialog)
  origin.RegisterSequence(priest_oaths_think_it_over_dialog)
  origin.RegisterSequence(priest_oaths_already_taken_dialog)
  origin.RegisterSequence(priest_oaths_dusk_info_dialog)
  origin.RegisterSequence(priest_oaths_congrats_dusk_dialog)
  origin.RegisterSequence(priest_oaths_dawn_info_dialog)
  origin.RegisterSequence(priest_oaths_congrats_dawn_dialog)

  priest_oaths_lecture.AddMenuCheckExpression("return priest_oaths_available() == true")
  origin.AddPursuit(priest_oaths_lecture)
end
