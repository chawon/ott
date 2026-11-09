package app.ottline.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import app.ottline.model.BookClassification
import app.ottline.model.LogStatus
import app.ottline.model.Occasion
import app.ottline.model.Place
import app.ottline.model.Provider
import app.ottline.model.Title
import app.ottline.model.TitleType
import app.ottline.model.WatchLog
import app.ottline.model.WatchLogHistory
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val dbJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

@Entity(
    tableName = "titles",
    indices = [
        Index(value = ["provider", "providerId"]),
        Index(value = ["isbn13"])
    ]
)
data class TitleEntity(
    @PrimaryKey val id: String,
    val type: String,
    val name: String,
    val year: Int? = null,
    val genresJson: String? = null,
    val directorsJson: String? = null,
    val castJson: String? = null,
    val overview: String? = null,
    val posterUrl: String? = null,
    val author: String? = null,
    val publisher: String? = null,
    val isbn10: String? = null,
    val isbn13: String? = null,
    val pubdate: String? = null,
    val provider: String? = null,
    val providerId: String? = null,
    val updatedAt: String? = null,
    val deletedAt: String? = null
) {
    fun toModel(): Title = Title(
        id = id,
        type = TitleType.fromWire(type),
        name = name,
        year = year,
        genres = genresJson?.let { runCatching { dbJson.decodeFromString<List<String>>(it) }.getOrNull() },
        directors = directorsJson?.let { runCatching { dbJson.decodeFromString<List<String>>(it) }.getOrNull() },
        cast = castJson?.let { runCatching { dbJson.decodeFromString<List<String>>(it) }.getOrNull() },
        overview = overview,
        posterUrl = posterUrl,
        author = author,
        publisher = publisher,
        isbn10 = isbn10,
        isbn13 = isbn13,
        pubdate = pubdate,
        provider = Provider.fromWire(provider),
        providerId = providerId,
        updatedAt = updatedAt,
        deletedAt = deletedAt
    )

    companion object {
        fun fromModel(t: Title): TitleEntity = TitleEntity(
            id = t.id,
            type = t.type.wireValue,
            name = t.name,
            year = t.year,
            genresJson = t.genres?.let { dbJson.encodeToString(it) },
            directorsJson = t.directors?.let { dbJson.encodeToString(it) },
            castJson = t.cast?.let { dbJson.encodeToString(it) },
            overview = t.overview,
            posterUrl = t.posterUrl,
            author = t.author,
            publisher = t.publisher,
            isbn10 = t.isbn10,
            isbn13 = t.isbn13,
            pubdate = t.pubdate,
            provider = t.provider?.name,
            providerId = t.providerId,
            updatedAt = t.updatedAt,
            deletedAt = t.deletedAt
        )
    }
}

@Entity(
    tableName = "watch_logs",
    indices = [
        Index(value = ["titleId"]),
        Index(value = ["watchedAt"]),
        Index(value = ["updatedAt"])
    ]
)
data class WatchLogEntity(
    @PrimaryKey val id: String,
    val titleId: String,
    val status: String,
    val rating: Double? = null,
    val note: String? = null,
    val spoiler: Boolean = false,
    val ott: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val origin: String? = "LOG",
    val syncStatus: String = "pending",
    val watchedAt: String,
    val place: String? = null,
    val occasion: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val deletedAt: String? = null
) {
    fun toModel(title: Title): WatchLog = WatchLog(
        id = id,
        title = title,
        status = runCatching { LogStatus.valueOf(status) }.getOrDefault(LogStatus.DONE),
        rating = rating,
        note = note,
        spoiler = spoiler,
        ott = ott,
        seasonNumber = seasonNumber,
        episodeNumber = episodeNumber,
        seasonPosterUrl = seasonPosterUrl,
        seasonYear = seasonYear,
        origin = origin ?: "LOG",
        syncStatus = syncStatus,
        updatedAt = updatedAt,
        deletedAt = deletedAt,
        watchedAt = watchedAt,
        place = Place.fromWire(place),
        occasion = Occasion.fromWire(occasion),
        createdAt = createdAt
    )

    companion object {
        fun fromModel(log: WatchLog): WatchLogEntity = WatchLogEntity(
            id = log.id,
            titleId = log.title.id,
            status = log.status.name,
            rating = log.rating,
            note = log.note,
            spoiler = log.spoiler,
            ott = log.ott,
            seasonNumber = log.seasonNumber,
            episodeNumber = log.episodeNumber,
            seasonPosterUrl = log.seasonPosterUrl,
            seasonYear = log.seasonYear,
            origin = log.origin ?: "LOG",
            syncStatus = log.syncStatus ?: "synced",
            watchedAt = log.watchedAt,
            place = log.place?.name,
            occasion = log.occasion?.name,
            createdAt = log.createdAt,
            updatedAt = log.updatedAt ?: log.createdAt,
            deletedAt = log.deletedAt
        )
    }
}

@Entity(
    tableName = "watch_log_history",
    indices = [Index(value = ["logId"])]
)
data class WatchLogHistoryEntity(
    @PrimaryKey val id: String,
    val logId: String,
    val recordedAt: String,
    val status: String,
    val rating: Double? = null,
    val note: String? = null,
    val spoiler: Boolean = false,
    val ott: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val seasonPosterUrl: String? = null,
    val seasonYear: Int? = null,
    val origin: String? = "LOG",
    val watchedAt: String,
    val place: String? = null,
    val occasion: String? = null
) {
    fun toModel(): WatchLogHistory = WatchLogHistory(
        id = id,
        logId = logId,
        recordedAt = recordedAt,
        status = runCatching { LogStatus.valueOf(status) }.getOrDefault(LogStatus.DONE),
        rating = rating,
        note = note,
        spoiler = spoiler,
        ott = ott,
        seasonNumber = seasonNumber,
        episodeNumber = episodeNumber,
        seasonPosterUrl = seasonPosterUrl,
        seasonYear = seasonYear,
        origin = origin ?: "LOG",
        watchedAt = watchedAt,
        place = Place.fromWire(place),
        occasion = Occasion.fromWire(occasion)
    )

    companion object {
        fun fromModel(h: WatchLogHistory): WatchLogHistoryEntity = WatchLogHistoryEntity(
            id = h.id,
            logId = h.logId,
            recordedAt = h.recordedAt,
            status = h.status.name,
            rating = h.rating,
            note = h.note,
            spoiler = h.spoiler,
            ott = h.ott,
            seasonNumber = h.seasonNumber,
            episodeNumber = h.episodeNumber,
            seasonPosterUrl = h.seasonPosterUrl,
            seasonYear = h.seasonYear,
            origin = h.origin ?: "LOG",
            watchedAt = h.watchedAt,
            place = h.place?.name,
            occasion = h.occasion?.name
        )
    }
}

@Entity(tableName = "outbox")
data class OutboxEntity(
    @PrimaryKey val id: String,
    val type: String, // "create_log" | "update_log"
    val targetLogId: String,
    val logChangeJson: String,
    val titleChangeJson: String? = null,
    val createdAt: String,
    val lastError: String? = null,
    val revision: Long = 1L
)

@Entity(tableName = "book_classifications")
data class BookClassificationEntity(
    @PrimaryKey val isbn13: String,
    val status: String,
    val kdcCode: String? = null,
    val kdcMajor: Int? = null,
    val fetchedAt: String
) {
    fun toModel(): BookClassification = BookClassification(
        isbn13 = isbn13,
        status = status,
        kdcCode = kdcCode,
        kdcMajor = kdcMajor,
        fetchedAt = fetchedAt
    )

    companion object {
        fun fromModel(item: BookClassification): BookClassificationEntity = BookClassificationEntity(
            isbn13 = item.isbn13,
            status = item.status,
            kdcCode = item.kdcCode,
            kdcMajor = item.kdcMajor,
            fetchedAt = item.fetchedAt
        )
    }
}

@Dao
interface TitleDao {
    @Query("SELECT * FROM titles WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): TitleEntity?

    @Query("SELECT * FROM titles")
    suspend fun getAll(): List<TitleEntity>

    @Query("SELECT * FROM titles")
    fun observeAll(): Flow<List<TitleEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: TitleEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<TitleEntity>)

    @Query("DELETE FROM titles WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM titles")
    suspend fun clearAll()
}

@Dao
interface WatchLogDao {
    @Query("SELECT * FROM watch_logs WHERE deletedAt IS NULL ORDER BY updatedAt DESC")
    fun observeActiveLogs(): Flow<List<WatchLogEntity>>

    @Query("SELECT * FROM watch_logs WHERE deletedAt IS NULL ORDER BY updatedAt DESC")
    suspend fun getActiveLogs(): List<WatchLogEntity>

    @Query("SELECT * FROM watch_logs WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): WatchLogEntity?

    @Query("SELECT * FROM watch_logs WHERE titleId = :titleId AND deletedAt IS NULL ORDER BY updatedAt DESC")
    suspend fun getActiveByTitleId(titleId: String): List<WatchLogEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: WatchLogEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<WatchLogEntity>)

    @Query("UPDATE watch_logs SET syncStatus = :syncStatus WHERE id = :id")
    suspend fun updateSyncStatus(id: String, syncStatus: String)

    @Query("UPDATE watch_logs SET deletedAt = :deletedAt, updatedAt = :updatedAt, syncStatus = :syncStatus WHERE id = :id")
    suspend fun markDeleted(id: String, deletedAt: String, updatedAt: String, syncStatus: String)

    @Query("UPDATE watch_logs SET titleId = :newTitleId WHERE titleId = :oldTitleId")
    suspend fun remapTitleId(oldTitleId: String, newTitleId: String)

    @Query("DELETE FROM watch_logs WHERE titleId = :titleId AND id != :keepLogId")
    suspend fun deleteByTitleExcept(titleId: String, keepLogId: String)

    @Query("DELETE FROM watch_logs")
    suspend fun clearAll()
}

@Dao
interface WatchLogHistoryDao {
    @Query("SELECT * FROM watch_log_history WHERE logId = :logId ORDER BY recordedAt DESC LIMIT :limit")
    suspend fun getByLogId(logId: String, limit: Int = 50): List<WatchLogHistoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: WatchLogHistoryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<WatchLogHistoryEntity>)

    @Query("UPDATE watch_log_history SET logId = :newLogId WHERE logId = :oldLogId")
    suspend fun remapLogId(oldLogId: String, newLogId: String)

    @Query("DELETE FROM watch_log_history")
    suspend fun clearAll()
}

@Dao
interface OutboxDao {
    @Query("SELECT * FROM outbox ORDER BY createdAt ASC")
    suspend fun getAll(): List<OutboxEntity>

    @Query("SELECT * FROM outbox WHERE targetLogId = :logId LIMIT 1")
    suspend fun getByTargetLogId(logId: String): OutboxEntity?

    @Query("SELECT COUNT(*) FROM outbox")
    fun observeCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entity: OutboxEntity)

    @Query("DELETE FROM outbox WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM outbox WHERE id = :id AND revision = :revision")
    suspend fun deleteIfRevisionMatches(id: String, revision: Long): Int

    @Query("DELETE FROM outbox WHERE targetLogId = :logId")
    suspend fun deleteByTargetLogId(logId: String)

    @Query("UPDATE outbox SET targetLogId = :newLogId, logChangeJson = :logJson, titleChangeJson = :titleJson WHERE id = :id")
    suspend fun remapIds(id: String, newLogId: String, logJson: String, titleJson: String?)

    @Query("UPDATE outbox SET lastError = :error WHERE id = :id")
    suspend fun updateError(id: String, error: String?)

    @Query("DELETE FROM outbox")
    suspend fun clearAll()
}

@Dao
interface BookClassificationDao {
    @Query("SELECT * FROM book_classifications")
    fun observeAll(): Flow<List<BookClassificationEntity>>

    @Query("SELECT * FROM book_classifications WHERE isbn13 IN (:isbns)")
    suspend fun getByIsbns(isbns: List<String>): List<BookClassificationEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entities: List<BookClassificationEntity>)

    @Query("DELETE FROM book_classifications")
    suspend fun clearAll()
}

@Database(
    entities = [
        TitleEntity::class,
        WatchLogEntity::class,
        WatchLogHistoryEntity::class,
        OutboxEntity::class,
        BookClassificationEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class OttlineDatabase : RoomDatabase() {
    abstract fun titleDao(): TitleDao
    abstract fun watchLogDao(): WatchLogDao
    abstract fun watchLogHistoryDao(): WatchLogHistoryDao
    abstract fun outboxDao(): OutboxDao
    abstract fun bookClassificationDao(): BookClassificationDao

    companion object {
        val MIGRATION_1_2 = object : androidx.room.migration.Migration(1, 2) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE outbox ADD COLUMN revision INTEGER NOT NULL DEFAULT 1")
            }
        }

        @Volatile
        private var instance: OttlineDatabase? = null

        fun getInstance(context: Context): OttlineDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    OttlineDatabase::class.java,
                    "ottline_v2.db"
                )
                    .addMigrations(MIGRATION_1_2)
                    .fallbackToDestructiveMigrationOnDowngrade(true)
                    .build()
                    .also { instance = it }
            }
        }
    }
}
