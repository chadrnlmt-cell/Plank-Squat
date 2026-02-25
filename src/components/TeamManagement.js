// src/components/TeamManagement.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
} from "firebase/firestore";

export default function TeamManagement({ user }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const defaultFormState = {
    name: "",
    color: "#4CAF50",
  };

  const [formData, setFormData] = useState(defaultFormState);

  // Load teams from Firestore
  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "teams"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Sort by creation date
      data.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setTeams(data);
    } catch (error) {
      console.error("Error loading teams:", error);
      alert("Error loading teams");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!formData.name.trim()) {
      alert("Please enter a team name");
      return;
    }

    try {
      await addDoc(collection(db, "teams"), {
        name: formData.name.trim(),
        color: formData.color,
        createdAt: Timestamp.now(),
        createdBy: user.email,
      });

      setFormData(defaultFormState);
      setShowCreateForm(false);
      loadTeams();
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Error creating team");
    }
  };

  const handleEditClick = (team) => {
    setEditingTeam({
      id: team.id,
      name: team.name,
      color: team.color || "#4CAF50",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTeam.name.trim()) {
      alert("Please enter a team name");
      return;
    }

    try {
      await updateDoc(doc(db, "teams", editingTeam.id), {
        name: editingTeam.name.trim(),
        color: editingTeam.color,
      });

      setEditingTeam(null);
      loadTeams();
    } catch (error) {
      console.error("Error updating team:", error);
      alert("Error updating team");
    }
  };

  const handleDeleteClick = (team) => {
    setConfirmDelete({
      id: team.id,
      name: team.name,
    });
  };

  const confirmDeleteTeam = async (teamId) => {
    try {
      await deleteDoc(doc(db, "teams", teamId));
      setConfirmDelete(null);
      loadTeams();
    } catch (error) {
      console.error("Error deleting team:", error);
      alert("Error deleting team");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>Loading teams...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", paddingBottom: "100px" }}>
      <h2>Team Management</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Create and manage teams for team challenges
      </p>

      {/* Create New Team Button */}
      <button
        onClick={() => setShowCreateForm(!showCreateForm)}
        style={{
          padding: "12px 20px",
          fontSize: "16px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        {showCreateForm ? "Cancel" : "+ Create New Team"}
      </button>

      {/* CREATE FORM */}
      {showCreateForm && (
        <div
          style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h3>Create New Team</h3>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                Team Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Team Phoenix"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                Team Color
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  style={{
                    width: "60px",
                    height: "40px",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                />
                <span style={{ color: "#666" }}>{formData.color}</span>
              </div>
            </div>

            <div>
              <button
                onClick={handleCreateTeam}
                style={{
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FORM (Modal) */}
      {editingTeam && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h3>Edit Team</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                marginTop: "10px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  Team Name *
                </label>
                <input
                  type="text"
                  value={editingTeam.name}
                  onChange={(e) =>
                    setEditingTeam({ ...editingTeam, name: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "5px",
                    border: "1px solid #ddd",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  Team Color
                </label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="color"
                    value={editingTeam.color}
                    onChange={(e) =>
                      setEditingTeam({ ...editingTeam, color: e.target.value })
                    }
                    style={{
                      width: "60px",
                      height: "40px",
                      border: "1px solid #ddd",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  />
                  <span style={{ color: "#666" }}>{editingTeam.color}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  onClick={handleSaveEdit}
                  style={{
                    flex: 1,
                    padding: "12px",
                    fontSize: "16px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingTeam(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    fontSize: "16px",
                    backgroundColor: "#999",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "100%",
            }}
          >
            <h3>Delete Team</h3>
            <p style={{ fontSize: "16px", marginBottom: "20px", color: "#333" }}>
              Are you sure you want to delete "{confirmDelete.name}"? This action
              cannot be undone.
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => confirmDeleteTeam(confirmDelete.id)}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: "#d32f2f",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: "16px",
                  backgroundColor: "#999",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAMS LIST */}
      {teams.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            backgroundColor: "white",
            borderRadius: "8px",
          }}
        >
          <p style={{ color: "#999" }}>
            No teams yet. Create one to get started!
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {teams.map((team) => (
            <div
              key={team.id}
              style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                borderLeft: `5px solid ${team.color || "#ccc"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 5px 0" }}>{team.name}</h3>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        backgroundColor: team.color || "#ccc",
                        borderRadius: "3px",
                        border: "1px solid #ddd",
                      }}
                    />
                    <span style={{ color: "#999", fontSize: "14px" }}>
                      {team.color || "No color"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleEditClick(team)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "14px",
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick(team)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "14px",
                      backgroundColor: "#d32f2f",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
