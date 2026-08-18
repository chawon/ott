# WorkManager 2.10.0 uses Room 2.6.1, whose consumer rule keeps the generated
# RoomDatabase class but does not explicitly keep its constructor. AGP 9 strict
# keep-rule semantics require the constructor because Room creates it by reflection.
-keep class androidx.work.impl.WorkDatabase_Impl {
    <init>();
}
