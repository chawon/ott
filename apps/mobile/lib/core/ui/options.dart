import 'package:flutter/material.dart';

import 'texts_kr.dart';

const statusItems = <DropdownMenuItem<String>>[
  DropdownMenuItem(value: 'IN_PROGRESS', child: Text(KrText.statusInProgress)),
  DropdownMenuItem(value: 'DONE', child: Text(KrText.statusDone)),
  DropdownMenuItem(value: 'DROPPED', child: Text(KrText.statusDropped)),
  DropdownMenuItem(value: 'PAUSED', child: Text(KrText.statusPaused)),
];

const ratingItems = <DropdownMenuItem<double?>>[
  DropdownMenuItem(value: null, child: Text(KrText.ratingNone)),
  DropdownMenuItem(value: 5, child: Text(KrText.ratingBest)),
  DropdownMenuItem(value: 3, child: Text(KrText.ratingOk)),
  DropdownMenuItem(value: 1, child: Text(KrText.ratingBad)),
];

const placeItems = <DropdownMenuItem<String>>[
  DropdownMenuItem(value: 'HOME', child: Text(KrText.placeHome)),
  DropdownMenuItem(value: 'THEATER', child: Text(KrText.placeTheater)),
  DropdownMenuItem(value: 'TRANSIT', child: Text(KrText.placeTransit)),
  DropdownMenuItem(value: 'CAFE', child: Text(KrText.placeCafe)),
  DropdownMenuItem(value: 'OFFICE', child: Text(KrText.placeOffice)),
  DropdownMenuItem(value: 'ETC', child: Text(KrText.placeEtc)),
];

const occasionItems = <DropdownMenuItem<String>>[
  DropdownMenuItem(value: 'ALONE', child: Text(KrText.occAlone)),
  DropdownMenuItem(value: 'DATE', child: Text(KrText.occDate)),
  DropdownMenuItem(value: 'FAMILY', child: Text(KrText.occFamily)),
  DropdownMenuItem(value: 'FRIENDS', child: Text(KrText.occFriends)),
  DropdownMenuItem(value: 'BREAK', child: Text(KrText.occBreak)),
  DropdownMenuItem(value: 'ETC', child: Text(KrText.occEtc)),
];
