//! Literature Librarian Subsystem
//!
//! Handles autonomous scientific literature ingestion from arXiv and premise indexing.

pub mod arxiv;

pub use arxiv::{ArxivLibrarian, ArxivPaper, LibrarianError};
